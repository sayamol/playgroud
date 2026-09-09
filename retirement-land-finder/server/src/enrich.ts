import regionsData from './data/regions.json';
import type {
  DuplicateOffer,
  EnrichedListing,
  LocalizedName,
  NearestPoi,
  Poi,
  PoiKind,
  RawListing,
  Region,
  RegionId,
} from './types.js';
import { approxDriveMinutes, haversineKm } from './lib/geo.js';
import { resolveAppraisal, sampleAppraisal } from './appraisal/index.js';
import { buildDuplicateGroups } from './dedup.js';

const BKK = { lat: regionsData.bangkok.lat, lng: regionsData.bangkok.lng };
const POIS = regionsData.pois as unknown as Poi[];
const REGIONS = regionsData.regions as unknown as Region[];
const SQM_PER_SQWAH = 4;
const SQWAH_PER_RAI = 400;

const byKind: Record<PoiKind, Poi[]> = {
  hospital: POIS.filter((p) => p.kind === 'hospital'),
  mall: POIS.filter((p) => p.kind === 'mall'),
  market: POIS.filter((p) => p.kind === 'market'),
  nature: POIS.filter((p) => p.kind === 'nature'),
  airport: POIS.filter((p) => p.kind === 'airport'),
};

function nearestOf(from: { lat: number; lng: number }, kind: PoiKind): NearestPoi {
  let best: NearestPoi | null = null;
  for (const p of byKind[kind]) {
    const km = haversineKm(from, p);
    if (!best || km < best.km) best = { km: +km.toFixed(2), name: p.name };
  }
  return best ?? { km: NaN, name: { en: '—', th: '—' } };
}

function provinceHintFor(regionId: RegionId): string | undefined {
  return REGIONS.find((r) => r.id === regionId)?.province;
}

// ---- cache --------------------------------------------------------------
let cache: { at: number; data: EnrichedListing[] } | null = null;
let building: Promise<EnrichedListing[]> | null = null;
const TTL_MS = 1000 * 60 * 30;

export function invalidateEnrichCache() {
  cache = null;
}

export async function getEnriched(
  listings: RawListing[],
  { force = false }: { force?: boolean } = {},
): Promise<EnrichedListing[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (building) return building;
  building = build(listings)
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      building = null;
    });
  return building;
}

async function build(listings: RawListing[]): Promise<EnrichedListing[]> {
  // distances + appraisal (bounded concurrency so we are polite to the
  // Treasury / Nominatim services)
  const partial = listings.map((l) => {
    const at = { lat: l.lat, lng: l.lng };
    const nearestHospital = nearestOf(at, 'hospital');
    const nearestMall = nearestOf(at, 'mall');
    const nearestMarket = nearestOf(at, 'market');
    const nearestNature = nearestOf(at, 'nature');
    const nearestAirport = nearestOf(at, 'airport');
    const bangkokKm = +haversineKm(at, BKK).toFixed(1);
    const areaSqwah = Math.round(l.landAreaSqm / SQM_PER_SQWAH);
    const areaRai = +(areaSqwah / SQWAH_PER_RAI).toFixed(3);
    const pricePerSqwahThb = Math.round(l.priceThb / Math.max(1, areaSqwah));
    // distance to the nearest "town" facility (hospital or mall); guard
    // against a region with no POI of a kind so the appraisal models
    // never receive NaN.
    const finiteTownKms = [nearestHospital.km, nearestMall.km].filter((n) => Number.isFinite(n));
    const townKm = finiteTownKms.length ? Math.min(...finiteTownKms) : 12;
    return {
      l,
      nearestHospital,
      nearestMall,
      nearestMarket,
      nearestNature,
      nearestAirport,
      bangkokKm,
      areaSqwah,
      areaRai,
      pricePerSqwahThb,
      townKm,
    };
  });

  const appraisals = new Map<string, Awaited<ReturnType<typeof resolveAppraisal>>>();
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (idx < partial.length) {
      const cur = partial[idx++]!;
      const a = cur.l.sample
        ? sampleAppraisal(cur.l, cur.townKm)
        : await resolveAppraisal(cur.l, cur.townKm, provinceHintFor(cur.l.regionId));
      appraisals.set(cur.l.id, a);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const groups = buildDuplicateGroups(listings);
  const groupByListing = new Map<string, { id: string; members: RawListing[] }>();
  for (const g of groups) {
    const members = g.memberIds
      .map((id) => listings.find((l) => l.id === id)!)
      .filter(Boolean);
    for (const m of members) groupByListing.set(m.id, { id: g.id, members });
  }

  const enriched: EnrichedListing[] = partial.map((p) => {
    const l = p.l;
    const appraisal = appraisals.get(l.id)!;
    const valueRatio =
      appraisal.totalThb && appraisal.totalThb > 0
        ? +(l.priceThb / appraisal.totalThb).toFixed(3)
        : null;

    const grp = groupByListing.get(l.id)!;
    const sorted = [...grp.members].sort((a, b) => a.priceThb - b.priceThb);
    const cheapest = sorted[0]!;
    const otherOffers: DuplicateOffer[] = sorted
      .filter((m) => m.id !== l.id)
      .map((m) => ({
        listingId: m.id,
        source: m.source,
        sourceUrl: m.sourceUrl,
        priceThb: m.priceThb,
        pricePerSqwahThb: Math.round(m.priceThb / Math.max(1, p.areaSqwah)),
        scrapedAt: m.scrapedAt,
      }));

    return {
      ...l,
      areaRai: p.areaRai,
      areaSqwah: p.areaSqwah,
      pricePerSqwahThb: p.pricePerSqwahThb,
      bangkokKm: p.bangkokKm,
      bangkokDriveMin: approxDriveMinutes(p.bangkokKm),
      nearestHospital: p.nearestHospital,
      nearestMall: p.nearestMall,
      nearestMarket: p.nearestMarket,
      nearestNature: p.nearestNature,
      nearestAirport: p.nearestAirport,
      appraisal,
      valueRatio,
      dupGroupId: grp.id,
      dupCount: grp.members.length,
      isCheapestInGroup: cheapest.id === l.id,
      cheapestPriceThb: cheapest.priceThb,
      potentialSavingThb: Math.max(0, l.priceThb - cheapest.priceThb),
      otherOffers,
    };
  });

  return enriched;
}

export function localized(n: LocalizedName, lang: 'en' | 'th'): string {
  return lang === 'th' ? n.th : n.en;
}

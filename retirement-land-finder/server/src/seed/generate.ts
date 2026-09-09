/**
 * Deterministic sample-listing generator.
 *
 * These are NOT real listings. They are plausible parcels scattered
 * around the four target regions so the app is fully usable before you
 * wire up live scrapers. Prices, areas and coordinates are synthetic
 * but in a realistic range for each area (2023-2026 market).
 *
 * Run `npm run seed` to (re)write src/data/seed-listings.json.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { RawListing, RegionId, SourceId } from '../types.js';
import regionsData from '../data/regions.json';

const SQM_PER_SQWAH = 4;
const SQWAH_PER_RAI = 400;

interface RegionCfg {
  perSqwahMin: number;
  perSqwahMax: number;
  apprLoFactor: number; // appraisal as fraction of asking (low)
  apprHiFactor: number;
  trendMin: number;
  trendMax: number;
  yieldMin: number;
  yieldMax: number;
  labels: string[];
}

// Asking prices are deliberately kept in a believable band vs. Thai rural
// government appraisal (which the app fetches live for real). Most parcels
// land between ~฿0.7M and ฿2.5M.
const CFG: Record<RegionId, RegionCfg> = {
  khaoyai: {
    perSqwahMin: 2800, perSqwahMax: 11000,
    apprLoFactor: 0.45, apprHiFactor: 0.8,
    trendMin: 4, trendMax: 9, yieldMin: 2.5, yieldMax: 5.5,
    labels: ['near Khao Yai', 'Pak Chong', 'Thanarat Rd side', 'Moo Si', 'Pong Ta Long'],
  },
  huahin: {
    perSqwahMin: 3000, perSqwahMax: 10000,
    apprLoFactor: 0.4, apprHiFactor: 0.75,
    trendMin: 3, trendMax: 7, yieldMin: 3, yieldMax: 6,
    labels: ['Hua Hin hillside', 'Pran Buri', 'Nong Kae', 'Hin Lek Fai', 'Cha-am side'],
  },
  chiangmai: {
    perSqwahMin: 2500, perSqwahMax: 9000,
    apprLoFactor: 0.4, apprHiFactor: 0.78,
    trendMin: 3, trendMax: 8, yieldMin: 3, yieldMax: 6.5,
    labels: ['Mae Rim', 'San Kamphaeng', 'Hang Dong', 'Doi Saket', 'Mae On'],
  },
  bkknat: {
    perSqwahMin: 1800, perSqwahMax: 7000,
    apprLoFactor: 0.4, apprHiFactor: 0.8,
    trendMin: 2, trendMax: 6, yieldMin: 2.5, yieldMax: 5,
    labels: ['Nakhon Nayok', 'near Sarika', 'Ban Na', 'Kanchanaburi', 'Tha Muang'],
  },
};

const SOURCES: SourceId[] = ['ddproperty', 'kaidee', 'baania'];
const TITLES = ['Chanote (Nor Sor 4)', 'Nor Sor 3 Gor'];

/** Bump when the generator logic/params change so stores auto-regenerate. */
export const SEED_VERSION = 6;

// tiny deterministic PRNG (mulberry32)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length]!;
}

function raiNganWah(sqwah: number): string {
  const rai = Math.floor(sqwah / SQWAH_PER_RAI);
  const rem = sqwah - rai * SQWAH_PER_RAI;
  const ngan = Math.floor(rem / 100);
  const wah = Math.round(rem - ngan * 100);
  return `${rai}-${ngan}-${wah}`;
}

const BASE_DATE = new Date('2026-08-20T00:00:00Z').getTime();

export function generateSeed(): RawListing[] {
  const regions = regionsData.regions as unknown as {
    id: RegionId;
    center: [number, number];
  }[];
  const out: RawListing[] = [];
  const r = rng(20260909);
  let n = 0;

  for (const region of regions) {
    const cfg = CFG[region.id];
    const perRegion = 10;
    for (let i = 0; i < perRegion; i++) {
      n++;
      const [clat, clng] = region.center;
      // scatter within ~0.08 deg (~8 km), biased toward centre so most
      // parcels stay within reach of that region's facilities
      const spread = () => (r() + r() + r() - 1.5) * 0.075;
      const lat = +(clat + spread()).toFixed(5);
      const lng = +(clng + spread()).toFixed(5);

      const areaRai = +(0.5 + r() * 1.7).toFixed(2);
      const areaSqwah = Math.round(areaRai * SQWAH_PER_RAI);
      const areaSqm = areaSqwah * SQM_PER_SQWAH;

      const perSqwah = Math.round(
        (cfg.perSqwahMin + r() * (cfg.perSqwahMax - cfg.perSqwahMin)) / 100,
      ) * 100;
      const priceThb = Math.round((perSqwah * areaSqwah) / 10000) * 10000;

      const title = TITLES[Math.floor(r() * TITLES.length)]!;
      const label = pick(r, cfg.labels);
      const source = SOURCES[n % SOURCES.length]!;
      const daysAgo = Math.floor(r() * 150);
      const posted = new Date(BASE_DATE - daysAgo * 86400000).toISOString();

      out.push({
        id: `sample-${region.id}-${String(i + 1).padStart(2, '0')}`,
        source,
        sourceUrl: `https://www.${source}.com/sample/${region.id}-${i + 1}`,
        sourceListingId: `${region.id}-${i + 1}`,
        title: `${raiNganWah(areaSqwah)} rai ${title} land ${label}`,
        regionId: region.id,
        lat,
        lng,
        priceThb,
        landAreaSqm: areaSqm,
        landTitleType: title,
        postedDate: posted,
        scrapedAt: new Date(BASE_DATE).toISOString(),
        contactName: pick(r, ['Khun Somchai', 'Khun Nid', 'Baan Property', 'Khun Aor', 'Land Agent CM']),
        contactPhone: `0${8 + Math.floor(r() * 2)}${Math.floor(r() * 9)}-${Math.floor(1000000 + r() * 8999999)}`,
        description:
          `Synthetic sample parcel ${label}. ${areaRai} rai, ${title}. ` +
          `Road access, electricity nearby. Replace with real scraped data via the crawler.`,
        images: [
          `https://picsum.photos/seed/${region.id}${i}a/640/420`,
          `https://picsum.photos/seed/${region.id}${i}b/640/420`,
        ],
        sample: true,
        areaAppreciationPct: +(cfg.trendMin + r() * (cfg.trendMax - cfg.trendMin)).toFixed(1),
        rentalYieldPct: +(cfg.yieldMin + r() * (cfg.yieldMax - cfg.yieldMin)).toFixed(1),
      });
    }
  }

  // Inject cross-site duplicates: clone a few parcels onto other sources
  // at a slightly different price, sharing a parcelKey.
  const dupSeeds = [
    'sample-khaoyai-03',
    'sample-huahin-05',
    'sample-chiangmai-02',
    'sample-bkknat-04',
  ];
  const r2 = rng(777);
  for (const baseId of dupSeeds) {
    const base = out.find((l) => l.id === baseId);
    if (!base) continue;
    const parcelKey = `PK-${baseId}`;
    base.parcelKey = parcelKey;
    const others = SOURCES.filter((s) => s !== base.source);
    const copies = 1 + Math.floor(r2() * 2); // 1 or 2 extra listings
    for (let c = 0; c < copies; c++) {
      const src = others[c % others.length]!;
      const delta = 1 + (r2() * 0.16 - 0.06); // -6%..+10%
      const priceThb = Math.round((base.priceThb * delta) / 10000) * 10000;
      out.push({
        ...base,
        id: `${baseId}-dup${c + 1}`,
        source: src,
        sourceUrl: `https://www.${src}.com/sample/${base.sourceListingId}-alt${c + 1}`,
        sourceListingId: `${base.sourceListingId}-alt${c + 1}`,
        priceThb,
        // jitter the pin a hair so the map shows separate markers
        lat: +(base.lat + (r2() - 0.5) * 0.0006).toFixed(5),
        lng: +(base.lng + (r2() - 0.5) * 0.0006).toFixed(5),
        postedDate: new Date(BASE_DATE - Math.floor(r2() * 90) * 86400000).toISOString(),
        description: `${base.description} (Listed again on ${src}.)`,
        parcelKey,
      });
    }
  }

  return out;
}

// ---- CLI: npm run seed --------------------------------------------------
if (process.argv.includes('--write')) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, '..', 'data', 'seed-listings.json');
  const data = generateSeed();
  writeFileSync(target, JSON.stringify(data, null, 2));
  console.log(`Wrote ${data.length} sample listings -> ${target}`);
}

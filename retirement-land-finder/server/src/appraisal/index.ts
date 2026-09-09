import type { AppraisalInfo, RawListing, RegionId } from '../types.js';
import { getTreasuryAppraisal } from './treasury.js';

const SQM_PER_SQWAH = 4;
const HEURISTIC_FALLBACK =
  (process.env.APPRAISAL_HEURISTIC_FALLBACK ?? 'true') !== 'false';

/**
 * Heuristic appraisal used only when the live Treasury lookup returns
 * nothing (rural point with no digitised parcel, service down, etc.).
 * Baselines are rough THB/sq wah appraisal ranges per region; the value
 * scales with how close the parcel is to the nearest town facility.
 */
const HEUR: Record<RegionId, { lo: number; hi: number }> = {
  khaoyai: { lo: 2200, hi: 9000 },
  huahin: { lo: 2200, hi: 9000 },
  chiangmai: { lo: 1800, hi: 8000 },
  bkknat: { lo: 1200, hi: 5500 },
};

/**
 * Appraisal for SAMPLE listings. Their coordinates are synthetic, so a live
 * per-point Treasury lookup would match an unrelated real parcel and produce
 * nonsense value ratios. Instead we derive a believable regional baseline
 * (clearly labelled as sample). Real scraped listings still get the live
 * treasury.go.th lookup.
 */
const SAMPLE_BAND: Record<RegionId, { lo: number; hi: number }> = {
  khaoyai: { lo: 1400, hi: 6500 },
  huahin: { lo: 1600, hi: 8500 },
  chiangmai: { lo: 1300, hi: 6500 },
  bkknat: { lo: 900, hi: 4200 },
};

export function sampleAppraisal(
  listing: RawListing,
  kmToNearestTownFacility: number,
): AppraisalInfo {
  const band = SAMPLE_BAND[listing.regionId];
  const t = Math.max(0, Math.min(1, 1 - kmToNearestTownFacility / 18));
  const perSqwah = Math.round((band.lo + (band.hi - band.lo) * t) / 50) * 50;
  const areaSqwah = listing.landAreaSqm / SQM_PER_SQWAH;
  return {
    method: 'sample-data',
    perSqwahThb: perSqwah,
    previousPerSqwahThb: Math.round(perSqwah * 0.9),
    totalThb: Math.round(perSqwah * areaSqwah),
    note:
      'Sample listing — appraisal is a regional baseline estimate, not a live ' +
      'Treasury figure. Real scraped listings use the live treasury.go.th lookup.',
    fetchedAt: new Date().toISOString(),
  };
}

export function heuristicAppraisal(
  listing: RawListing,
  kmToNearestTownFacility: number,
): AppraisalInfo {
  const band = HEUR[listing.regionId];
  const t = Math.max(0, Math.min(1, 1 - kmToNearestTownFacility / 15));
  const perSqwah = Math.round((band.lo + (band.hi - band.lo) * t) / 100) * 100;
  const areaSqwah = listing.landAreaSqm / SQM_PER_SQWAH;
  return {
    method: 'heuristic-model',
    perSqwahThb: perSqwah,
    previousPerSqwahThb: null,
    totalThb: Math.round(perSqwah * areaSqwah),
    note:
      'Estimated — the Treasury parcel lookup returned no match for this point, ' +
      'so this is a distance-to-town heuristic, not an official figure.',
    fetchedAt: new Date().toISOString(),
  };
}

export async function resolveAppraisal(
  listing: RawListing,
  kmToNearestTownFacility: number,
  provinceHint?: string,
): Promise<AppraisalInfo> {
  const live = await getTreasuryAppraisal({
    lat: listing.lat,
    lng: listing.lng,
    landAreaSqm: listing.landAreaSqm,
    provinceHint,
  });
  if (live && live.perSqwahThb) return live;
  if (HEURISTIC_FALLBACK) return heuristicAppraisal(listing, kmToNearestTownFacility);
  return {
    method: 'heuristic-model',
    perSqwahThb: null,
    totalThb: null,
    note: 'No appraisal available (Treasury lookup failed, fallback disabled).',
    fetchedAt: new Date().toISOString(),
  };
}

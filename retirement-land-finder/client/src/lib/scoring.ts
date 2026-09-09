import type { FactorKey, Listing, ScoreBreakdown, Weights } from '../types';
import { estimateAllInCost } from './cost';

export const DEFAULT_WEIGHTS: Weights = {
  budget: 15,
  value: 15,
  nature: 20,
  facilities: 20,
  bangkok: 15,
  investment: 10,
  size: 5,
};

export const FACTOR_KEYS: FactorKey[] = [
  'budget',
  'value',
  'nature',
  'facilities',
  'bangkok',
  'investment',
  'size',
];

const clamp = (n: number, lo = 0, hi = 100) =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 50;
/**
 * Map value v in [a,b] linearly to [0,100], clamped; a may be > b to
 * invert. A non-finite input (an unknown distance, a missing stat)
 * scores as neutral rather than poisoning the total with NaN.
 */
function lin(v: number, a: number, b: number): number {
  if (!Number.isFinite(v)) return 50;
  if (a === b) return 50;
  return clamp(((v - a) / (b - a)) * 100);
}

export interface ScoreContext {
  budgetThb: number;
  /** score the budget factor against the estimated all-in cost, not the asking price */
  useAllInCost?: boolean;
}

export function factorScores(l: Listing, ctx: ScoreContext): Record<FactorKey, number> {
  // budget fit: at/under budget = 100; 60% over = 0
  const priceForBudget = ctx.useAllInCost
    ? estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb
    : l.priceThb;
  const over = (priceForBudget - ctx.budgetThb) / Math.max(1, ctx.budgetThb);
  const budget = priceForBudget <= ctx.budgetThb ? 100 : clamp(100 - (over / 0.6) * 100);

  // value vs government appraisal. Thai rural land routinely trades well
  // above the (very conservative) official appraisal, so the band is wide:
  // ratio <=1.0 -> 100 (at/below appraisal), ratio >=4.0 -> 0.
  const value = l.valueRatio == null ? 50 : lin(l.valueRatio, 4, 1);

  // nature: 0 km -> 100, 40 km -> 0
  const nature = lin(l.nearestNature.km, 40, 0);

  // facilities: weighted hospital/mall/market proximity
  const hosp = lin(l.nearestHospital.km, 25, 0);
  const mall = lin(l.nearestMall.km, 35, 0);
  const market = lin(l.nearestMarket.km, 20, 0);
  const facilities = clamp(hosp * 0.5 + mall * 0.3 + market * 0.2);

  // bangkok access: 60 min -> 100, 480 min -> 0
  const bangkok = lin(l.bangkokDriveMin, 480, 60);

  // investment: appreciation 2%..10%, value, rental yield 1%..6%
  const appr = lin(l.areaAppreciationPct, 2, 10);
  const yld = lin(l.rentalYieldPct, 1, 6);
  const investment = clamp(appr * 0.5 + value * 0.3 + yld * 0.2);

  // land size: 0.25 rai -> 15, 4 rai -> 100
  const size = clamp(15 + lin(l.areaRai, 0.25, 4) * 0.85);

  return { budget, value, nature, facilities, bangkok, investment, size };
}

export function score(l: Listing, weights: Weights, ctx: ScoreContext): ScoreBreakdown {
  const factors = factorScores(l, ctx);
  let wSum = 0;
  let acc = 0;
  for (const k of FACTOR_KEYS) {
    const w = Math.max(0, weights[k]);
    wSum += w;
    acc += w * factors[k];
  }
  const total = wSum > 0 ? acc / wSum : 0;
  return { factors, total: Math.round(total * 10) / 10 };
}

export function scoreColor(v: number): string {
  if (v >= 75) return 'var(--good)';
  if (v >= 55) return 'var(--ok)';
  if (v >= 35) return 'var(--warn)';
  return 'var(--bad)';
}

/**
 * Rough "all-in" cash estimate for buying a parcel in Thailand.
 *
 * This is an ILLUSTRATION, not tax advice. It covers the statutory
 * transaction line items that are easy to reason about:
 *
 *   - Transfer fee ...... 2%   of the fee base (Land Department)
 *   - Specific Business Tax  3.3% of the fee base, if the seller has
 *     owned the land < 5 years (the common case for land being flipped)
 *   - Stamp duty ........ 0.5% of the fee base, charged instead of SBT
 *     when the seller has owned the land 5 years or more
 *
 * The "fee base" is the government appraised value when we know it,
 * otherwise the asking price. Government fees are customarily split
 * between buyer and seller, so `buyerSharePct` (default 50%) scales the
 * portion added to the buyer's cost. A fixed `legalMiscThb` covers
 * conveyancing / agent / registration sundries.
 *
 * Seller's withholding tax is deliberately excluded — it is legally the
 * seller's and rarely lands on the buyer.
 */

export interface CostAssumptions {
  /** % of the combined government fees the buyer absorbs (0–100). */
  buyerSharePct: number;
  /** true => stamp duty (0.5%) applies instead of SBT (3.3%). */
  heldOver5Years: boolean;
  /** fixed conveyancing / agent / registration sundries, THB. */
  legalMiscThb: number;
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  buyerSharePct: 50,
  heldOver5Years: false,
  legalMiscThb: 25_000,
};

export interface AllInCost {
  /** the fee base used (appraised total when supplied, else asking price) */
  feeBaseThb: number;
  transferFeeThb: number;
  businessTaxThb: number;
  businessTaxLabel: string;
  legalMiscThb: number;
  /** government fees in full (transfer fee + SBT/stamp duty) */
  govFeesFullThb: number;
  /** the buyer's share of the government fees */
  govFeesBuyerThb: number;
  /** everything on top of the asking price the buyer should budget for */
  extraThb: number;
  /** asking price + extraThb */
  allInThb: number;
}

export interface AllInCostOptions extends Partial<CostAssumptions> {
  /** government appraised total for the whole plot, if known */
  appraisedTotalThb?: number | null;
}

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

export function estimateAllInCost(priceThb: number, opts: AllInCostOptions = {}): AllInCost {
  const a = { ...DEFAULT_COST_ASSUMPTIONS, ...opts };
  const price = Math.max(0, finite(priceThb));
  const appraised = finite(opts.appraisedTotalThb ?? 0);
  const feeBase = appraised > 0 ? appraised : price;

  const transferFeeThb = Math.round(feeBase * 0.02);
  const useStampDuty = a.heldOver5Years;
  const businessTaxThb = Math.round(feeBase * (useStampDuty ? 0.005 : 0.033));
  const businessTaxLabel = useStampDuty ? 'Stamp duty (0.5%)' : 'Specific Business Tax (3.3%)';

  const govFeesFullThb = transferFeeThb + businessTaxThb;
  const share = Math.min(100, Math.max(0, finite(a.buyerSharePct, 50))) / 100;
  const govFeesBuyerThb = Math.round(govFeesFullThb * share);
  const legalMiscThb = Math.max(0, finite(a.legalMiscThb, DEFAULT_COST_ASSUMPTIONS.legalMiscThb));

  const extraThb = govFeesBuyerThb + legalMiscThb;
  return {
    feeBaseThb: feeBase,
    transferFeeThb,
    businessTaxThb,
    businessTaxLabel,
    legalMiscThb,
    govFeesFullThb,
    govFeesBuyerThb,
    extraThb,
    allInThb: price + extraThb,
  };
}

/** Budget minus the all-in cost of a parcel. Negative => over budget. */
export function budgetHeadroomThb(
  budgetThb: number,
  priceThb: number,
  opts: AllInCostOptions = {},
): number {
  return finite(budgetThb) - estimateAllInCost(priceThb, opts).allInThb;
}

import { describe, expect, it } from 'vitest';
import { budgetHeadroomThb, estimateAllInCost, DEFAULT_COST_ASSUMPTIONS } from './cost';

describe('estimateAllInCost', () => {
  it('adds statutory fees plus fixed legal costs on top of the asking price', () => {
    const r = estimateAllInCost(2_000_000);
    // base 2,000,000; transfer 2% = 40,000; SBT 3.3% = 66,000; gov total 106,000
    // buyer share 50% = 53,000; + legal misc 25,000 => extra 78,000
    expect(r.transferFeeThb).toBe(40_000);
    expect(r.businessTaxThb).toBe(66_000);
    expect(r.legalMiscThb).toBe(DEFAULT_COST_ASSUMPTIONS.legalMiscThb);
    expect(r.extraThb).toBe(78_000);
    expect(r.allInThb).toBe(2_078_000);
  });

  it('uses the government appraised total as the fee base when it is provided', () => {
    const r = estimateAllInCost(2_000_000, { appraisedTotalThb: 1_000_000 });
    // fees computed on 1,000,000, not on the 2,000,000 asking price
    expect(r.transferFeeThb).toBe(20_000);
    expect(r.businessTaxThb).toBe(33_000);
    expect(r.allInThb).toBe(2_000_000 + (20_000 + 33_000) / 2 + DEFAULT_COST_ASSUMPTIONS.legalMiscThb);
  });

  it('applies stamp duty instead of SBT when the seller has held the land over five years', () => {
    const r = estimateAllInCost(2_000_000, { heldOver5Years: true });
    expect(r.businessTaxThb).toBe(10_000); // 0.5% stamp duty
    expect(r.businessTaxLabel).toMatch(/stamp duty/i);
  });

  it('lets the caller take on the whole government fee bill', () => {
    const half = estimateAllInCost(1_000_000);
    const full = estimateAllInCost(1_000_000, { buyerSharePct: 100 });
    expect(full.extraThb).toBeGreaterThan(half.extraThb);
    expect(full.govFeesBuyerThb).toBe(half.govFeesFullThb);
  });

  it('never returns NaN for a zero or negative price', () => {
    for (const p of [0, -1, Number.NaN]) {
      const r = estimateAllInCost(p as number);
      expect(Number.isFinite(r.allInThb)).toBe(true);
      expect(Number.isFinite(r.extraThb)).toBe(true);
    }
  });

  it('budgetHeadroomThb is the budget minus the all-in cost', () => {
    const r = estimateAllInCost(1_800_000);
    expect(r.allInThb).toBeGreaterThan(1_800_000);
    expect(budgetHeadroomThb(2_000_000, 1_800_000)).toBe(2_000_000 - r.allInThb);
  });
});

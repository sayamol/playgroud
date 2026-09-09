import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, factorScores, score, scoreColor } from './scoring';
import type { Listing } from '../types';

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    source: 'ddproperty',
    sourceUrl: '',
    sourceListingId: 'l1',
    title: 'l1',
    regionId: 'khaoyai',
    lat: 14.6,
    lng: 101.38,
    priceThb: 1_500_000,
    landAreaSqm: 1600,
    landTitleType: 'Chanote',
    postedDate: '2026-01-01',
    scrapedAt: '2026-01-01',
    images: [],
    areaAppreciationPct: 5,
    rentalYieldPct: 3.5,
    areaRai: 1,
    areaSqwah: 400,
    pricePerSqwahThb: 3750,
    bangkokKm: 150,
    bangkokDriveMin: 200,
    nearestHospital: { km: 8, name: { en: 'H', th: 'H' } },
    nearestMall: { km: 12, name: { en: 'M', th: 'M' } },
    nearestMarket: { km: 6, name: { en: 'K', th: 'K' } },
    nearestNature: { km: 4, name: { en: 'N', th: 'N' } },
    nearestAirport: { km: 40, name: { en: 'A', th: 'A' } },
    appraisal: {
      method: 'treasury.go.th',
      perSqwahThb: 4000,
      totalThb: 1_600_000,
      note: '',
      fetchedAt: '2026-01-01',
    },
    valueRatio: 0.94,
    dupGroupId: 'g1',
    dupCount: 1,
    isCheapestInGroup: true,
    cheapestPriceThb: 1_500_000,
    potentialSavingThb: 0,
    otherOffers: [],
    ...over,
  };
}

const ctx = { budgetThb: 2_000_000 };

describe('factorScores', () => {
  it('keeps every factor within 0..100', () => {
    const f = factorScores(listing(), ctx);
    for (const v of Object.values(f)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('gives full budget marks at or under budget and 0 well over budget', () => {
    expect(factorScores(listing({ priceThb: 2_000_000 }), ctx).budget).toBe(100);
    expect(factorScores(listing({ priceThb: 4_000_000 }), ctx).budget).toBe(0);
  });

  it('rewards land priced below the government appraisal', () => {
    const below = factorScores(listing({ valueRatio: 0.8 }), ctx).value;
    const above = factorScores(listing({ valueRatio: 3.5 }), ctx).value;
    expect(below).toBeGreaterThan(above);
  });

  it('treats an unknown appraisal ratio as neutral', () => {
    expect(factorScores(listing({ valueRatio: null }), ctx).value).toBe(50);
  });

  it('does not produce NaN when a distance is unknown (NaN)', () => {
    const l = listing({
      nearestNature: { km: NaN, name: { en: '-', th: '-' } },
      nearestHospital: { km: NaN, name: { en: '-', th: '-' } },
      nearestMall: { km: NaN, name: { en: '-', th: '-' } },
      nearestMarket: { km: NaN, name: { en: '-', th: '-' } },
    });
    const f = factorScores(l, ctx);
    for (const v of Object.values(f)) expect(Number.isNaN(v)).toBe(false);
  });

  it('uses the all-in cost for the budget factor when asked', () => {
    // asking 1,980,000 fits a 2,000,000 budget, but all-in cost does not
    const l = listing({ priceThb: 1_980_000 });
    expect(factorScores(l, { budgetThb: 2_000_000 }).budget).toBe(100);
    expect(
      factorScores(l, { budgetThb: 2_000_000, useAllInCost: true }).budget,
    ).toBeLessThan(100);
  });
});

describe('score', () => {
  it('is the weighted average of the factors, rounded to 0.1', () => {
    const s = score(listing(), DEFAULT_WEIGHTS, ctx);
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(Math.round(s.total * 10) / 10).toBe(s.total);
  });

  it('returns 0 when every weight is 0 rather than NaN', () => {
    const zero = { budget: 0, value: 0, nature: 0, facilities: 0, bangkok: 0, investment: 0, size: 0 };
    expect(score(listing(), zero, ctx).total).toBe(0);
  });

  it('never returns NaN even with broken inputs', () => {
    const l = listing({
      nearestNature: { km: NaN, name: { en: '-', th: '-' } },
      areaRai: NaN,
      areaAppreciationPct: NaN,
    });
    expect(Number.isNaN(score(l, DEFAULT_WEIGHTS, ctx).total)).toBe(false);
  });
});

describe('scoreColor', () => {
  it('maps score bands to CSS variables', () => {
    expect(scoreColor(90)).toBe('var(--good)');
    expect(scoreColor(60)).toBe('var(--ok)');
    expect(scoreColor(40)).toBe('var(--warn)');
    expect(scoreColor(10)).toBe('var(--bad)');
  });
});

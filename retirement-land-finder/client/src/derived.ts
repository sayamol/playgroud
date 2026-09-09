import { useMemo } from 'react';
import { useStore } from './store';
import { score, type ScoreContext } from './lib/scoring';
import { estimateAllInCost } from './lib/cost';
import type { Listing } from './types';

export interface Scored {
  listing: Listing;
  total: number;
}

export function useScoreContext(): ScoreContext {
  const budgetThb = useStore((s) => s.filters.budgetThb);
  const useAllInCost = useStore((s) => s.filters.useAllInCost);
  return useMemo(() => ({ budgetThb, useAllInCost }), [budgetThb, useAllInCost]);
}

/** Price a parcel is measured against the budget with — asking, or asking + costs. */
export function budgetPriceOf(l: Listing, useAllInCost: boolean): number {
  return useAllInCost
    ? estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb
    : l.priceThb;
}

export function useDerived() {
  const listings = useStore((s) => s.listings);
  const filters = useStore((s) => s.filters);
  const sort = useStore((s) => s.sort);
  const weights = useStore((s) => s.weights);
  const ctx = useScoreContext();

  return useMemo(() => {
    /** every filter except the budget ceiling */
    const passesNonBudget = (l: Listing) => {
      if (!filters.regions.has(l.regionId)) return false;
      if (l.sample && !filters.includeSample) return false;
      if (!l.sample && !filters.sources.has(l.source)) return false;
      if (l.bangkokDriveMin > filters.maxBangkokHrs * 60) return false;
      if (Number.isFinite(l.nearestHospital.km) && l.nearestHospital.km > filters.maxHospitalKm)
        return false;
      if (Number.isFinite(l.nearestNature.km) && l.nearestNature.km > filters.maxNatureKm)
        return false;
      if (filters.onlyCheapest && l.dupCount > 1 && !l.isCheapestInGroup) return false;
      return true;
    };

    const withinBudget = (l: Listing) =>
      budgetPriceOf(l, filters.useAllInCost) <= filters.budgetThb;
    const filtered = listings.filter((l) => passesNonBudget(l) && withinBudget(l));
    const overBudgetCount = listings.filter(
      (l) => passesNonBudget(l) && !withinBudget(l),
    ).length;

    const scored: Scored[] = filtered.map((l) => ({
      listing: l,
      total: score(l, weights, ctx).total,
    }));

    // ascending, but push unknown (NaN) values to the end
    const asc = (x: number, y: number) => {
      const xn = Number.isFinite(x);
      const yn = Number.isFinite(y);
      if (!xn && !yn) return 0;
      if (!xn) return 1;
      if (!yn) return -1;
      return x - y;
    };
    scored.sort((a, b) => {
      switch (sort) {
        case 'price':
          return asc(a.listing.priceThb, b.listing.priceThb);
        case 'bangkok':
          return asc(a.listing.bangkokDriveMin, b.listing.bangkokDriveMin);
        case 'nature':
          return asc(a.listing.nearestNature.km, b.listing.nearestNature.km);
        default:
          return b.total - a.total;
      }
    });

    return { scored, filteredCount: filtered.length, overBudgetCount };
  }, [listings, filters, sort, weights, ctx]);
}

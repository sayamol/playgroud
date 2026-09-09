import { describe, expect, it } from 'vitest';
import { buildDuplicateGroups } from './dedup.js';
import type { RawListing } from './types.js';

function listing(over: Partial<RawListing> & { id: string }): RawListing {
  return {
    source: 'ddproperty',
    sourceUrl: `https://x/${over.id}`,
    sourceListingId: over.id,
    title: over.id,
    regionId: 'khaoyai',
    lat: 14.6,
    lng: 101.38,
    priceThb: 1_000_000,
    landAreaSqm: 1600,
    landTitleType: 'Chanote',
    postedDate: '2026-01-01T00:00:00Z',
    scrapedAt: '2026-01-01T00:00:00Z',
    images: [],
    areaAppreciationPct: 4,
    rentalYieldPct: 3.5,
    ...over,
  };
}

describe('buildDuplicateGroups', () => {
  it('puts every listing in exactly one group', () => {
    const ls = [listing({ id: 'a' }), listing({ id: 'b', lat: 12.5, lng: 99.9 })];
    const groups = buildDuplicateGroups(ls);
    const seen = groups.flatMap((g) => g.memberIds);
    expect(seen.sort()).toEqual(['a', 'b']);
    expect(groups).toHaveLength(2);
  });

  it('groups listings that share an explicit parcelKey regardless of distance', () => {
    const ls = [
      listing({ id: 'a', parcelKey: 'PK-1' }),
      listing({ id: 'b', parcelKey: 'PK-1', lat: 18.8, lng: 98.9 }),
      listing({ id: 'c', parcelKey: 'PK-2' }),
    ];
    const groups = buildDuplicateGroups(ls);
    const g = groups.find((x) => x.memberIds.includes('a'))!;
    expect(g.memberIds.sort()).toEqual(['a', 'b']);
  });

  it('groups near-identical parcels by location + area when in the same region', () => {
    const ls = [
      listing({ id: 'a', lat: 14.6, lng: 101.38, landAreaSqm: 1600 }),
      listing({ id: 'b', lat: 14.6008, lng: 101.3805, landAreaSqm: 1700 }),
    ];
    const groups = buildDuplicateGroups(ls);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds.sort()).toEqual(['a', 'b']);
  });

  it('does not group parcels that are far apart', () => {
    const ls = [
      listing({ id: 'a', lat: 14.6, lng: 101.38 }),
      listing({ id: 'b', lat: 14.7, lng: 101.5 }),
    ];
    expect(buildDuplicateGroups(ls)).toHaveLength(2);
  });

  it('does not group parcels whose areas differ by more than the tolerance', () => {
    const ls = [
      listing({ id: 'a', landAreaSqm: 1600 }),
      listing({ id: 'b', lat: 14.6002, lng: 101.3802, landAreaSqm: 4000 }),
    ];
    expect(buildDuplicateGroups(ls)).toHaveLength(2);
  });

  it('does not group parcels in different regions even when coordinates coincide', () => {
    const ls = [
      listing({ id: 'a', regionId: 'khaoyai' }),
      listing({ id: 'b', regionId: 'huahin' }),
    ];
    expect(buildDuplicateGroups(ls)).toHaveLength(2);
  });
});

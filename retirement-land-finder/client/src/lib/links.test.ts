import { describe, expect, it } from 'vitest';
import { hasRealSourceUrl, mapsHref } from './links';

describe('mapsHref', () => {
  it('builds a Google Maps query link for the coordinate', () => {
    expect(mapsHref(14.6, 101.38)).toBe(
      'https://www.google.com/maps/search/?api=1&query=14.6,101.38',
    );
  });
});

describe('hasRealSourceUrl', () => {
  it('is false for sample listings even when they carry a URL', () => {
    expect(
      hasRealSourceUrl({ sample: true, sourceUrl: 'https://www.baania.com/sample/khaoyai-1' }),
    ).toBe(false);
  });

  it('is true for a real scraped listing with an http(s) URL', () => {
    expect(hasRealSourceUrl({ sourceUrl: 'https://www.ddproperty.com/listing/12345' })).toBe(true);
  });

  it('is false when the URL is missing or not http(s)', () => {
    expect(hasRealSourceUrl({ sourceUrl: '' })).toBe(false);
    expect(hasRealSourceUrl({})).toBe(false);
    expect(hasRealSourceUrl({ sourceUrl: 'javascript:alert(1)' })).toBe(false);
  });
});

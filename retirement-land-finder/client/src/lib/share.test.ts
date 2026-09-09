import { describe, expect, it } from 'vitest';
import { decodeShareState, encodeShareState, shareUrl } from './share';
import { DEFAULT_WEIGHTS } from './scoring';

const sample = {
  compareIds: ['sample-khaoyai-01', 'sample-huahin-03'],
  weights: { ...DEFAULT_WEIGHTS, nature: 30, budget: 5 },
  budgetThb: 1_800_000,
  useAllInCost: true,
};

describe('encode/decode round trip', () => {
  it('preserves every field', () => {
    const back = decodeShareState(encodeShareState(sample));
    expect(back).toEqual(sample);
  });

  it('produces a URL-safe token (no +, /, = or whitespace)', () => {
    expect(encodeShareState(sample)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('defaults useAllInCost to false when it was not set', () => {
    const back = decodeShareState(encodeShareState({ ...sample, useAllInCost: false }));
    expect(back?.useAllInCost).toBe(false);
  });
});

describe('decodeShareState is defensive', () => {
  it('returns null for garbage', () => {
    expect(decodeShareState('')).toBeNull();
    expect(decodeShareState('not-base64-$$$')).toBeNull();
    expect(decodeShareState(btoa('{"not":"our shape"}'))).not.toBeNull(); // tolerated, fields just absent
  });

  it('drops non-string compare ids and non-finite weights', () => {
    const token = btoa(
      JSON.stringify({ c: ['ok', 42, null], w: { nature: 'x', budget: 10 }, b: 'nope' }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const back = decodeShareState(token);
    expect(back?.compareIds).toEqual(['ok']);
    expect(back?.weights?.budget).toBe(10);
    expect(back?.weights && 'nature' in back.weights).toBe(false);
    expect(back?.budgetThb).toBeUndefined();
  });

  it('ignores an absurd number of compare ids', () => {
    const many = Array.from({ length: 999 }, (_, i) => `id-${i}`);
    const back = decodeShareState(encodeShareState({ ...sample, compareIds: many }));
    expect(back?.compareIds!.length).toBeLessThanOrEqual(12);
  });
});

describe('shareUrl', () => {
  it('appends the token as the c query param', () => {
    const url = shareUrl('https://example.com', '/app', sample);
    expect(url.startsWith('https://example.com/app?c=')).toBe(true);
    const token = new URL(url).searchParams.get('c')!;
    expect(decodeShareState(token)).toEqual(sample);
  });
});

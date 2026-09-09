import { describe, expect, it } from 'vitest';
import { approxDriveMinutes, haversineKm, nearest } from './geo.js';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 13.75, lng: 100.5 }, { lat: 13.75, lng: 100.5 })).toBe(0);
  });

  it('matches a known distance (Bangkok -> Chiang Mai ~580 km)', () => {
    const d = haversineKm({ lat: 13.7563, lng: 100.5018 }, { lat: 18.7883, lng: 98.9853 });
    expect(d).toBeGreaterThan(560);
    expect(d).toBeLessThan(600);
  });

  it('is symmetric', () => {
    const a = { lat: 12.5, lng: 99.9 };
    const b = { lat: 18.8, lng: 98.95 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });

  it('is ~111 km for one degree of latitude', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe('approxDriveMinutes', () => {
  it('adds a fixed overhead for a zero-distance trip', () => {
    expect(approxDriveMinutes(0)).toBe(12);
  });

  it('grows monotonically with distance', () => {
    expect(approxDriveMinutes(50)).toBeLessThan(approxDriveMinutes(120));
  });

  it('estimates ~150 min for 120 straight-line km', () => {
    // 120 km * 1.3 detour / 62 km/h * 60 + 12  ~= 163 min
    expect(approxDriveMinutes(120)).toBeGreaterThan(140);
    expect(approxDriveMinutes(120)).toBeLessThan(185);
  });
});

describe('nearest', () => {
  const pts = [
    { id: 'a', lat: 13.75, lng: 100.5 },
    { id: 'b', lat: 18.8, lng: 98.95 },
    { id: 'c', lat: 12.5, lng: 99.9 },
  ];

  it('returns the closest candidate with its label', () => {
    const r = nearest({ lat: 13.7, lng: 100.4 }, pts, (p) => p.id.toUpperCase());
    expect(r?.id).toBe('a');
    expect(r?.name).toBe('A');
    expect(r?.km).toBeGreaterThan(0);
  });

  it('returns null for an empty candidate list', () => {
    expect(nearest({ lat: 0, lng: 0 }, [], () => '')).toBeNull();
  });
});

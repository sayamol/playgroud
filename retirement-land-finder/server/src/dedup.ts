import type { RawListing } from './types.js';
import { haversineKm } from './lib/geo.js';

const SAME_PARCEL_KM = 0.16; // ~160 m
const AREA_TOLERANCE = 0.12; // 12%

export interface DupGroup {
  id: string;
  memberIds: string[];
}

/**
 * Group listings that almost certainly describe the SAME physical parcel:
 *  - identical parcelKey (explicit), or
 *  - same region + within ~160 m + land area within 12%.
 */
export function buildDuplicateGroups(listings: RawListing[]): DupGroup[] {
  const groups: DupGroup[] = [];
  const groupOf = new Map<string, DupGroup>();

  // 1) explicit parcelKey
  const byKey = new Map<string, RawListing[]>();
  for (const l of listings) {
    if (!l.parcelKey) continue;
    let arr = byKey.get(l.parcelKey);
    if (!arr) {
      arr = [];
      byKey.set(l.parcelKey, arr);
    }
    arr.push(l);
  }
  for (const [key, ls] of byKey) {
    const g: DupGroup = { id: `pk_${key}`, memberIds: ls.map((l) => l.id) };
    groups.push(g);
    for (const l of ls) groupOf.set(l.id, g);
  }

  // 2) spatial clustering for the rest
  const rest = listings.filter((l) => !groupOf.has(l.id));
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (groupOf.has(a.id)) continue;
    const g: DupGroup = { id: `geo_${a.id}`, memberIds: [a.id] };
    groupOf.set(a.id, g);
    for (let j = i + 1; j < rest.length; j++) {
      const b = rest[j]!;
      if (groupOf.has(b.id)) continue;
      if (a.regionId !== b.regionId) continue;
      const km = haversineKm(a, b);
      if (km > SAME_PARCEL_KM) continue;
      const areaDiff = Math.abs(a.landAreaSqm - b.landAreaSqm) / Math.max(a.landAreaSqm, b.landAreaSqm);
      if (areaDiff > AREA_TOLERANCE) continue;
      g.memberIds.push(b.id);
      groupOf.set(b.id, g);
    }
    groups.push(g);
  }

  return groups;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // km

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/**
 * Very rough driving-time estimate from a straight-line distance.
 * Thailand upcountry roads: assume ~62 km/h effective plus a fixed
 * "get in/out of the car" overhead. Clearly an approximation.
 */
export function approxDriveMinutes(straightLineKm: number): number {
  const roadKm = straightLineKm * 1.3; // detour factor
  return Math.round((roadKm / 62) * 60 + 12);
}

export interface NearestResult {
  km: number;
  name: string;
  id: string;
}

export function nearest<T extends LatLng & { id: string }>(
  from: LatLng,
  candidates: T[],
  label: (t: T) => string,
): NearestResult | null {
  let best: NearestResult | null = null;
  for (const c of candidates) {
    const km = haversineKm(from, c);
    if (!best || km < best.km) best = { km, name: label(c), id: c.id };
  }
  return best;
}

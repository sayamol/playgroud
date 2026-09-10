/** Google Maps search link for a coordinate. */
export function mapsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * True when a listing points at a real, followable source page. Sample
 * listings carry a synthetic `https://www.<site>.com/sample/...` URL that
 * 404s on the real site, so their "view on source site" action must fall
 * back to something useful (the map) instead.
 */
export function hasRealSourceUrl(l: { sample?: boolean; sourceUrl?: string }): boolean {
  return !l.sample && !!l.sourceUrl && /^https?:\/\/\S+$/.test(l.sourceUrl);
}

/**
 * LIVE government land-appraisal lookup.
 *
 * Source: Treasury Department (กรมธนารักษ์) + Department of Lands ArcGIS
 * services that power https://assessprice.treasury.go.th
 *
 *   MapServer:  TD_FORMER/TD_Former_Staff_ViewData/MapServer
 *   Layers:     one group layer per province ("แปลงที่ดิน จ.<province>")
 *               with polygon feature sub-layers for Chanote / Nor Sor 3 Gor.
 *   Field:      CURR_EVAPRICE = current appraised price, THB per sq wah (ตร.ว.)
 *               PREV_EVAPRICE = previous cycle
 *
 * The ArcGIS host (p-gis.treasury.go.th) requires a token for direct calls,
 * but the site's own public proxy does not:
 *
 *   https://assessprice.treasury.go.th/assessprice/ashx/Proxy.ashx?<RAW target URL>
 *
 * The target URL must be appended RAW (its own "?f=json&..." intact); the
 * proxy has an allow-list and rejects a percent-encoded target. Individual
 * parameter *values* (the geometry JSON, outFields list) are still encoded.
 *
 * No API key. A point is resolved to a Thai province (province hint, or OSM
 * Nominatim) so we know which province layer to query.
 */
import type { AppraisalInfo } from '../types.js';

const MAPSERVER =
  process.env.TREASURY_MAPSERVER ||
  'https://p-gis.treasury.go.th/arcgis/rest/services/TD_FORMER/TD_Former_Staff_ViewData/MapServer';
const PROXY =
  process.env.TREASURY_PROXY ||
  'https://assessprice.treasury.go.th/assessprice/ashx/Proxy.ashx?';
const REFERER = 'https://assessprice.treasury.go.th/';
const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const NOMINATIM_EMAIL = process.env.NOMINATIM_EMAIL || '';

const SQM_PER_SQWAH = 4;
const DEBUG = process.env.TREASURY_DEBUG === '1';

// ---- caches -------------------------------------------------------------
let layerMapPromise: Promise<Map<string, number[]>> | null = null;
const provinceCache = new Map<string, string | null>();
const resultCache = new Map<string, { at: number; value: AppraisalInfo | null }>();
const RESULT_TTL_MS = 1000 * 60 * 60 * 12;

// ---- politeness gates -------------------------------------------------
function gate(minGapMs: number) {
  let last = 0;
  return async () => {
    const wait = minGapMs - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  };
}
const arcgisGate = gate(200);
const nominatimGate = gate(1100);

async function rawFetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': `retirement-land-finder/0.1 (${NOMINATIM_EMAIL || 'local dev'})`,
      Accept: 'application/json',
      ...headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Call an ArcGIS REST endpoint through the Treasury public proxy.
 * The upstream service intermittently answers "Failed to execute query"
 * (HTTP 200 body with an error object), so we retry a couple of times.
 */
async function arcgis(targetUrl: string, retries = 2): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    await arcgisGate();
    try {
      const j = await rawFetchJson(PROXY + targetUrl, { Referer: REFERER });
      if (j && j.error) throw new Error(`ArcGIS error ${j.error.code}: ${j.error.message}`);
      return j;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 400 + attempt * 400));
    }
  }
}

/** province (Thai) -> [feature layer ids], built once from /layers. */
function loadLayerMap(): Promise<Map<string, number[]>> {
  if (layerMapPromise) return layerMapPromise;
  layerMapPromise = (async () => {
    const data = await arcgis(`${MAPSERVER}/layers?f=json`);
    const byId = new Map<number, any>();
    for (const l of data.layers || []) byId.set(l.id, l);
    const map = new Map<string, number[]>();
    for (const l of data.layers || []) {
      const m = /^แปลงที่ดิน จ\.(.+)$/.exec(String(l.name || '').trim());
      if (!m || l.type !== 'Group Layer') continue;
      const province = m[1].trim();
      const subIds: number[] =
        l.subLayerIds ??
        (Array.isArray(l.subLayers) ? l.subLayers.map((s: any) => s.id) : []);
      const ids: number[] = [];
      for (const subId of subIds) {
        const sub = byId.get(subId);
        const name = String(sub?.name ?? '');
        const isFeature = sub?.type === 'Feature Layer';
        const looksParcel = /โฉนด|นส\s?3|นส3/.test(name);
        if (isFeature || looksParcel) ids.push(subId);
      }
      if (ids.length) map.set(province, ids);
    }
    return map;
  })().catch((err) => {
    layerMapPromise = null; // allow a later retry
    throw err;
  });
  return layerMapPromise;
}

async function resolveProvince(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (provinceCache.has(key)) return provinceCache.get(key)!;
  await nominatimGate();
  const url =
    `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=8` +
    `&accept-language=th${NOMINATIM_EMAIL ? `&email=${encodeURIComponent(NOMINATIM_EMAIL)}` : ''}`;
  let province: string | null = null;
  try {
    const j = await rawFetchJson(url);
    const a = j.address || {};
    const raw: string = a.province || a.state || a.region || '';
    province = raw.replace(/^จังหวัด\s*/, '').replace(/\s*Province$/i, '').trim() || null;
    if (/bangkok|กรุงเทพ/i.test(raw)) province = 'กรุงเทพมหานคร';
  } catch {
    province = null;
  }
  provinceCache.set(key, province);
  return province;
}

/** parse "rai-ngan-wah" (e.g. "1-2-30.5") to sq wah; 0 when unknown. */
function areaToSqwah(s: unknown): number {
  if (typeof s !== 'string') return 0;
  const m = /^(\d+)-(\d+)-([\d.]+)/.exec(s.trim());
  if (!m) return 0;
  return Number(m[1]) * 400 + Number(m[2]) * 100 + Number(m[3]);
}

async function queryParcel(layerId: number, lat: number, lng: number): Promise<any | null> {
  const d = 0.00035; // ~38 m half-box
  const geom = {
    xmin: lng - d, ymin: lat - d, xmax: lng + d, ymax: lat + d,
    spatialReference: { wkid: 4326 },
  };
  const target =
    `${MAPSERVER}/${layerId}/query?f=json` +
    `&geometry=${encodeURIComponent(JSON.stringify(geom))}` +
    `&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326` +
    `&spatialRel=esriSpatialRelIntersects&returnGeometry=false&resultRecordCount=10` +
    `&outFields=${encodeURIComponent(
      'CHANGWAT_NAME,AMPHUR_NAME,TUMBON_NAME,CHANOD_NO,LAND_NO,LAND_AREA,PREV_EVAPRICE,CURR_EVAPRICE',
    )}`;
  try {
    const j = await arcgis(target);
    const priced = (j.features || [])
      .map((f: any) => f.attributes)
      .filter((a: any) => Number(a.CURR_EVAPRICE) > 0);
    if (!priced.length) return null;
    // Prefer the smallest titled plot (more likely a real residential parcel
    // than a blanket-rate agricultural block); fall back to highest price.
    priced.sort((a: any, b: any) => {
      const aa = areaToSqwah(a.LAND_AREA);
      const ba = areaToSqwah(b.LAND_AREA);
      if (aa > 0 && ba > 0 && aa !== ba) return aa - ba;
      if ((aa > 0) !== (ba > 0)) return aa > 0 ? -1 : 1;
      return Number(b.CURR_EVAPRICE) - Number(a.CURR_EVAPRICE);
    });
    return priced[0];
  } catch {
    return null;
  }
}

export interface TreasuryLookupInput {
  lat: number;
  lng: number;
  /** listing land area, used to compute a total appraised value */
  landAreaSqm: number;
  /** Thai province name; skips the reverse-geocode call when supplied. */
  provinceHint?: string;
}

export async function getTreasuryAppraisal(
  input: TreasuryLookupInput,
): Promise<AppraisalInfo | null> {
  const key = `${input.lat.toFixed(4)},${input.lng.toFixed(4)},${Math.round(input.landAreaSqm)}`;
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) return cached.value;

  let value: AppraisalInfo | null = null;
  try {
    const province =
      input.provinceHint?.replace(/^จังหวัด\s*/, '').trim() ||
      (await resolveProvince(input.lat, input.lng));
    if (province) {
      const layerMap = await loadLayerMap();
      const layerIds =
        layerMap.get(province) ||
        layerMap.get(province.replace('จังหวัด', '').trim()) ||
        [];
      if (DEBUG)
        console.error(
          `[treasury] province="${province}" layerIds=${JSON.stringify(layerIds)} mapKeys=${layerMap.size}`,
        );
      for (const id of layerIds) {
        const attr = await queryParcel(id, input.lat, input.lng);
        if (DEBUG) console.error(`[treasury]  layer ${id} -> ${attr ? 'HIT ' + attr.CURR_EVAPRICE : 'miss'}`);
        if (attr) {
          const perSqwah = Number(attr.CURR_EVAPRICE) || null;
          const areaSqwah = input.landAreaSqm / SQM_PER_SQWAH;
          value = {
            method: 'treasury.go.th',
            perSqwahThb: perSqwah,
            previousPerSqwahThb: Number(attr.PREV_EVAPRICE) || null,
            totalThb: perSqwah ? Math.round(perSqwah * areaSqwah) : null,
            chanoteNo: attr.CHANOD_NO ?? null,
            parcelLandArea: attr.LAND_AREA ?? null,
            tumbon: attr.TUMBON_NAME ?? null,
            amphur: attr.AMPHUR_NAME ?? null,
            changwat: attr.CHANGWAT_NAME ?? province,
            note:
              'Current official appraised price (บัญชีราคาประเมินที่ดิน) per sq wah, ' +
              'from the Treasury Dept / Dept of Lands ArcGIS service, matched to the ' +
              'parcel polygon at this point.',
            fetchedAt: new Date().toISOString(),
          };
          break;
        }
      }
    }
  } catch (err) {
    console.error('[treasury] lookup failed:', (err as Error).message);
    value = null;
  }

  resultCache.set(key, { at: Date.now(), value });
  return value;
}

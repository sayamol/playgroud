import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store';
import { useDerived } from '../derived';
import { api } from '../api';
import { baht, loc } from '../lib/format';
import { scoreColor } from '../lib/scoring';
import { t } from '../i18n';
import type { AppraisalInfo, Listing, PoiKind } from '../types';

const POI_COLOR: Record<PoiKind, string> = {
  hospital: '#e17076',
  mall: '#0984e3',
  market: '#fdcb6e',
  nature: '#00b894',
  airport: '#636e72',
};
const POI_ICON: Record<PoiKind, string> = {
  hospital: '🏥',
  mall: '🛍',
  market: '🥬',
  nature: '🌳',
  airport: '✈️',
};

function pinIcon(color: string, selected: boolean) {
  const size = selected ? 30 : 20;
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="width:${size}px;height:${size}px;background:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/**
 * Fit the map to the visible parcels, but only when `trigger` changes
 * (region selection changed, or the user pressed the fit button) — not on
 * every budget/slider tweak, so a zoom-in isn't yanked away mid-browse.
 */
function FitBounds({ listings, trigger }: { listings: Listing[]; trigger: string }) {
  const map = useMap();
  useEffect(() => {
    if (!listings.length) return;
    const b = L.latLngBounds(listings.map((l) => [l.lat, l.lng] as [number, number]));
    map.fitBounds(b.pad(0.25), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

function FlyToSelected() {
  const map = useMap();
  const selectedId = useStore((s) => s.selectedId);
  const listings = useStore((s) => s.listings);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    // fly only when the selection itself changes — not when the listing
    // array is replaced by a data refresh.
    if (selectedId === prev.current) return;
    prev.current = selectedId;
    const l = listings.find((x) => x.id === selectedId);
    if (l) map.flyTo([l.lat, l.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [selectedId, listings, map]);
  return null;
}

interface Probe {
  lat: number;
  lng: number;
  status: 'loading' | 'done' | 'error';
  result?: AppraisalInfo | null;
}

/** Click anywhere to drop a pin and pull the live Treasury appraisal for that point. */
function ProbeAppraisal({ lang }: { lang: 'en' | 'th' }) {
  const [probe, setProbe] = useState<Probe | null>(null);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setProbe({ lat, lng, status: 'loading' });
      try {
        const r = await api.appraisal(lat, lng, 1600);
        setProbe({ lat, lng, status: 'done', result: r.appraisal ?? null });
      } catch {
        setProbe({ lat, lng, status: 'error' });
      }
    },
  });

  if (!probe) return null;
  const a = probe.result;
  return (
    <Marker
      position={[probe.lat, probe.lng]}
      icon={pinIcon('#6c5ce7', true)}
      eventHandlers={{ add: (e) => e.target.openPopup() }}
    >
      <Popup>
        <div style={{ minWidth: 190 }}>
          <b>📍 {t('probeTitle', lang)}</b>
          <div className="muted" style={{ margin: '2px 0' }}>
            {probe.lat.toFixed(5)}, {probe.lng.toFixed(5)}
          </div>
          {probe.status === 'loading' && <div>{t('loading', lang)}</div>}
          {probe.status === 'error' && (
            <div className="muted">{t('probeError', lang)}</div>
          )}
          {probe.status === 'done' && !a && (
            <div className="muted">{t('probeNone', lang)}</div>
          )}
          {probe.status === 'done' && a && (
            <div>
              <div style={{ fontWeight: 800, margin: '4px 0' }}>
                {a.perSqwahThb ? `${baht(a.perSqwahThb)} ${t('perSqwah', lang)}` : '—'}
              </div>
              <div className="muted">
                {[a.tumbon, a.amphur, a.changwat].filter(Boolean).join(' / ') || '—'}
                {a.chanoteNo ? ` · Chanote ${a.chanoteNo}` : ''}
              </div>
              <div className="muted" style={{ marginTop: 2 }}>
                {a.method === 'treasury.go.th' ? 'treasury.go.th' : a.method}
                {' · '}
                {t('probeAreaNote', lang)}
              </div>
            </div>
          )}
          <button
            className="btn ghost xs"
            style={{ marginTop: 6 }}
            onClick={() => setProbe(null)}
          >
            {t('clearPin', lang)}
          </button>
        </div>
      </Popup>
    </Marker>
  );
}

export function MapPanel() {
  const lang = useStore((s) => s.lang);
  const regionsData = useStore((s) => s.regionsData);
  const selectedId = useStore((s) => s.selectedId);
  const setSelected = useStore((s) => s.setSelected);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const compareIds = useStore((s) => s.compareIds);
  const { scored } = useDerived();
  const [fitSignal, setFitSignal] = useState(0);

  const listings = useMemo(() => scored.map((s) => s.listing), [scored]);
  const totalById = useMemo(
    () => new Map(scored.map((s) => [s.listing.id, s.total])),
    [scored],
  );
  const regionSig = useMemo(
    () => [...new Set(listings.map((l) => l.regionId))].sort().join(','),
    [listings],
  );

  return (
    <div className="mapwrap">
      <MapContainer center={[14.5, 100.6]} zoom={6} scrollWheelZoom preferCanvas>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {regionsData?.pois.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: POI_COLOR[p.kind], fillOpacity: 0.9 }}
          >
            <Popup>
              <b>{loc(p.name, lang)}</b>
              <br />
              <span className="muted">
                {POI_ICON[p.kind]} {p.kind}
              </span>
            </Popup>
          </CircleMarker>
        ))}

        {listings.map((l) => {
          const total = totalById.get(l.id) ?? 0;
          const isSel = l.id === selectedId;
          return (
            <Marker
              key={l.id}
              position={[l.lat, l.lng]}
              icon={pinIcon(isSel ? '#2d3436' : scoreColor(total), isSel)}
              eventHandlers={{ click: () => setSelected(l.id) }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <b>{l.title}</b>
                  <div style={{ margin: '4px 0', fontWeight: 800 }}>{baht(l.priceThb)}</div>
                  <div className="muted">
                    {l.areaRai} {t('rai', lang)} · {l.source}
                    {l.dupCount > 1 && ` · ${l.dupCount}× listed`}
                  </div>
                  <div style={{ margin: '6px 0' }}>
                    {t('score', lang)}: <b style={{ color: scoreColor(total) }}>{total}</b>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => toggleCompare(l.id)}
                    style={{ width: '100%' }}
                  >
                    {compareIds.includes(l.id) ? `✓ ${t('inCompare', lang)}` : `+ ${t('compare', lang)}`}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FitBounds listings={listings} trigger={`${regionSig}|${fitSignal}`} />
        <FlyToSelected />
        <ProbeAppraisal lang={lang} />
      </MapContainer>

      <div className="map-legend">
        <div className="ml-title">{lang === 'th' ? 'สัญลักษณ์' : 'Legend'}</div>
        {(Object.keys(POI_COLOR) as PoiKind[]).map((k) => (
          <div className="ml-row" key={k}>
            <span className="ml-dot" style={{ background: POI_COLOR[k] }} />
            {POI_ICON[k]} {t(k, lang)}
          </div>
        ))}
        <div className="ml-row ml-note">
          <span className="ml-pin" /> {lang === 'th' ? 'สีหมุด = คะแนน' : 'pin colour = score'}
        </div>
        <div className="ml-row ml-note">📍 {t('probeHint', lang)}</div>
      </div>

      <button
        className="map-fit-btn"
        title={lang === 'th' ? 'ปรับให้เห็นทุกแปลง' : 'Fit map to results'}
        onClick={() => setFitSignal((n) => n + 1)}
      >
        ⤢
      </button>
    </div>
  );
}

import { useEffect, type ReactNode } from 'react';
import { useStore } from '../store';
import { useDerived, useScoreContext } from '../derived';
import { t } from '../i18n';
import { baht, km, pct, hrs, loc } from '../lib/format';
import { score, scoreColor, FACTOR_KEYS } from '../lib/scoring';
import { estimateAllInCost } from '../lib/cost';
import { exportListings } from '../lib/excel';
import type { Listing } from '../types';

interface RowDef {
  label: string;
  /** numeric value for best-cell highlighting; omit `better` to skip highlight */
  get?: (l: Listing) => number | null;
  better?: 'low' | 'high';
  render: (l: Listing) => ReactNode;
}

interface Section {
  title: string;
  rows: RowDef[];
}

function mapsHref(l: Listing) {
  return `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
}

function offersOf(l: Listing) {
  // this listing + every other offer for the same plot, cheapest first
  const all = [
    { source: l.source, priceThb: l.priceThb, pricePerSqwahThb: l.pricePerSqwahThb, sourceUrl: l.sourceUrl, self: true },
    ...l.otherOffers.map((o) => ({ ...o, self: false })),
  ];
  return all.sort((a, b) => a.priceThb - b.priceThb);
}

export function CompareModal() {
  const lang = useStore((s) => s.lang);
  const show = useStore((s) => s.showCompare);
  const setShow = useStore((s) => s.setShowCompare);
  const compareIds = useStore((s) => s.compareIds);
  const listings = useStore((s) => s.listings);
  const weights = useStore((s) => s.weights);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const clearCompare = useStore((s) => s.clearCompare);
  const setSelected = useStore((s) => s.setSelected);
  const flash = useStore((s) => s.flash);
  const copyShareLink = useStore((s) => s.copyShareLink);
  const ctx = useScoreContext();
  const { scored } = useDerived();

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, setShow]);

  if (!show) return null;

  const items = compareIds
    .map((id) => listings.find((l) => l.id === id))
    .filter((x): x is Listing => !!x)
    .map((l) => ({ l, s: score(l, weights, ctx) }))
    .sort((a, b) => b.s.total - a.s.total);

  if (!items.length) {
    return (
      <div className="overlay" onClick={() => setShow(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="mhead">
            <b>⚖️ {t('fullComparison', lang)}</b>
            <div className="spacer" />
            <button className="btn" onClick={() => setShow(false)}>✕</button>
          </div>
          <p style={{ padding: 24 }} className="muted">
            {lang === 'th' ? 'ยังไม่ได้เลือกที่ดินเพื่อเปรียบเทียบ' : 'No parcels selected to compare yet.'}
          </p>
        </div>
      </div>
    );
  }

  const openDetail = (id: string) => {
    setSelected(id);
    setShow(false);
  };

  const sections: Section[] = [
    {
      title: t('sec_price', lang),
      rows: [
        { label: `${lang === 'th' ? 'ราคาขาย' : 'Asking price'}`, get: (l) => l.priceThb, better: 'low', render: (l) => baht(l.priceThb, { compact: true }) },
        { label: `${lang === 'th' ? 'ราคา' : 'Price'} ${t('perSqwah', lang)}`, get: (l) => l.pricePerSqwahThb, better: 'low', render: (l) => baht(l.pricePerSqwahThb) },
        {
          label: t('duplicates', lang),
          get: (l) => l.potentialSavingThb,
          better: 'low',
          render: (l) =>
            l.dupCount > 1
              ? l.isCheapestInGroup
                ? <span className="tag good">✓ {t('cheapestHere', lang)}</span>
                : <span className="tag warn">+{baht(l.potentialSavingThb, { compact: true })}</span>
              : '—',
        },
        { label: `${t('govAppraisal', lang)} ${t('perSqwah', lang)}`, get: (l) => l.appraisal.perSqwahThb, better: 'high', render: (l) => (l.appraisal.perSqwahThb ? baht(l.appraisal.perSqwahThb) : '—') },
        { label: t('govTotal', lang), get: (l) => l.appraisal.totalThb, better: 'high', render: (l) => (l.appraisal.totalThb ? baht(l.appraisal.totalThb, { compact: true }) : '—') },
        {
          label: t('askVsAppraisal', lang),
          get: (l) => l.valueRatio,
          better: 'low',
          render: (l) =>
            l.valueRatio == null
              ? '—'
              : l.valueRatio < 1
                ? <span className="tag good">{Math.round((1 - l.valueRatio) * 100)}% {t('belowAppraisal', lang)}</span>
                : <span className="tag warn">{Math.round((l.valueRatio - 1) * 100)}% {t('aboveAppraisal', lang)}</span>,
        },
        { label: t('appraisalSource', lang), render: (l) => appraisalSourceCell(l, lang) },
        {
          label: t('allInCost', lang),
          get: (l) => estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb,
          better: 'low',
          render: (l) =>
            baht(
              estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb,
              { compact: true },
            ),
        },
        {
          label: t('budgetHeadroom', lang),
          get: (l) =>
            ctx.budgetThb -
            estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb,
          better: 'high',
          render: (l) => {
            const h =
              ctx.budgetThb -
              estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb }).allInThb;
            return (
              <span className={h >= 0 ? 'tag good' : 'tag warn'}>
                {h >= 0 ? '' : '−'}
                {baht(Math.abs(h), { compact: true })}
              </span>
            );
          },
        },
      ],
    },
    {
      title: t('sec_land', lang),
      rows: [
        { label: `${lang === 'th' ? 'ขนาด' : 'Size'} (${t('rai', lang)})`, get: (l) => l.areaRai, better: 'high', render: (l) => `${l.areaRai}` },
        { label: `${lang === 'th' ? 'ขนาด' : 'Size'} (${t('perSqwah', lang).replace('/ ', '')})`, get: (l) => l.areaSqwah, better: 'high', render: (l) => `${l.areaSqwah}` },
        { label: t('landTitle', lang), render: (l) => l.landTitleType },
        { label: t('parcel', lang), render: (l) => (l.appraisal.chanoteNo ? String(l.appraisal.chanoteNo) : '—') },
        {
          label: t('locationRow', lang),
          render: (l) =>
            [l.appraisal.tumbon, l.appraisal.amphur, l.appraisal.changwat].filter(Boolean).join(' / ') || '—',
        },
        {
          label: t('coordinates', lang),
          render: (l) => (
            <a href={mapsHref(l)} target="_blank" rel="noreferrer">
              {l.lat.toFixed(4)}, {l.lng.toFixed(4)} ↗
            </a>
          ),
        },
      ],
    },
    {
      title: t('sec_access', lang),
      rows: [
        { label: `🚗 ${t('fromBangkok', lang)}`, get: (l) => l.bangkokDriveMin, better: 'low', render: (l) => `${Math.round(l.bangkokKm)} km · ~${hrs(l.bangkokDriveMin)}` },
        { label: `✈️ ${t('airport', lang)}`, get: (l) => l.nearestAirport.km, better: 'low', render: (l) => `${km(l.nearestAirport.km)} · ${loc(l.nearestAirport.name, lang)}` },
      ],
    },
    {
      title: t('sec_fac', lang),
      rows: [
        { label: `🏥 ${t('hospital', lang)}`, get: (l) => l.nearestHospital.km, better: 'low', render: (l) => `${km(l.nearestHospital.km)} · ${loc(l.nearestHospital.name, lang)}` },
        { label: `🛍 ${t('mall', lang)}`, get: (l) => l.nearestMall.km, better: 'low', render: (l) => `${km(l.nearestMall.km)} · ${loc(l.nearestMall.name, lang)}` },
        { label: `🥬 ${t('market', lang)}`, get: (l) => l.nearestMarket.km, better: 'low', render: (l) => `${km(l.nearestMarket.km)} · ${loc(l.nearestMarket.name, lang)}` },
      ],
    },
    {
      title: t('sec_nature', lang),
      rows: [
        { label: `🌳 ${t('nature', lang)}`, get: (l) => l.nearestNature.km, better: 'low', render: (l) => `${km(l.nearestNature.km)} · ${loc(l.nearestNature.name, lang)}` },
      ],
    },
    {
      title: t('sec_invest', lang),
      rows: [
        { label: t('appreciation', lang), get: (l) => l.areaAppreciationPct, better: 'high', render: (l) => pct(l.areaAppreciationPct) },
        { label: t('rentalYield', lang), get: (l) => l.rentalYieldPct, better: 'high', render: (l) => pct(l.rentalYieldPct) },
        { label: t('prevAppraisal', lang), render: (l) => (l.appraisal.previousPerSqwahThb ? baht(l.appraisal.previousPerSqwahThb) : '—') },
        {
          label: t('projected5', lang),
          get: (l) => l.priceThb * Math.pow(1 + l.areaAppreciationPct / 100, 5),
          better: 'high',
          render: (l) => baht(l.priceThb * Math.pow(1 + l.areaAppreciationPct / 100, 5), { compact: true }),
        },
      ],
    },
    {
      title: t('sec_sources', lang),
      rows: [
        { label: t('listingsFound', lang), get: (l) => l.dupCount, better: 'high', render: (l) => `${l.dupCount}` },
        {
          label: t('posted', lang),
          render: (l) => new Date(l.postedDate).toLocaleDateString(),
        },
        {
          label: t('contact', lang),
          render: (l) => [l.contactName, l.contactPhone].filter(Boolean).join(' · ') || '—',
        },
        {
          label: t('allOffers', lang),
          render: (l) => (
            <div className="offers">
              {offersOf(l).map((o, i) => (
                <a key={i} href={o.sourceUrl} target="_blank" rel="noreferrer" className={i === 0 ? 'cheap' : ''}>
                  {i === 0 ? '⬇ ' : ''}
                  {o.source} — {baht(o.priceThb, { compact: true })}
                  {'self' in o && o.self ? ` (${lang === 'th' ? 'ประกาศนี้' : 'this'})` : ''} ↗
                </a>
              ))}
            </div>
          ),
        },
        {
          label: lang === 'th' ? 'ตรวจสอบตำแหน่ง' : 'Verify location',
          render: (l) => (
            <a href={mapsHref(l)} target="_blank" rel="noreferrer">
              🗺 {t('viewOnMaps', lang)} ↗
            </a>
          ),
        },
      ],
    },
  ];

  const bestIdx = (r: RowDef): number => {
    if (!r.get || !r.better) return -1;
    let idx = -1;
    let val = r.better === 'low' ? Infinity : -Infinity;
    items.forEach(({ l }, i) => {
      const v = r.get!(l);
      if (v == null || Number.isNaN(v)) return;
      if ((r.better === 'low' && v < val) || (r.better === 'high' && v > val)) {
        val = v;
        idx = i;
      }
    });
    return idx;
  };

  return (
    <div className="overlay" onClick={() => setShow(false)}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <b>⚖️ {t('fullComparison', lang)} ({items.length})</b>
          <div className="spacer" />
          <button className="btn ghost" onClick={() => copyShareLink()}>
            🔗 {t('copyShareLink', lang)}
          </button>
          <button
            className="btn accent"
            onClick={async () => {
              try {
                await exportListings({
                  all: scored.map((x) => x.listing),
                  compared: items.map((x) => x.l),
                  weights,
                  ctx,
                  lang,
                });
                flash(lang === 'th' ? 'ส่งออก Excel แล้ว' : 'Exported comparison to Excel');
              } catch {
                flash(lang === 'th' ? 'ส่งออกไม่สำเร็จ' : 'Excel export failed');
              }
            }}
          >
            ⬇ {t('exportXlsx', lang)}
          </button>
          <button
            className="btn ghost"
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}
            onClick={() => {
              clearCompare();
              setShow(false);
            }}
          >
            {t('clear', lang)}
          </button>
          <button className="btn" onClick={() => setShow(false)}>
            ✕
          </button>
        </div>

        <p className="verifyhint">🔎 {t('verifyHint', lang)}</p>

        <div className="cmp-scroll">
          <table className="cmp">
            <thead>
              <tr>
                <th className="corner">{t('rank', lang)}</th>
                {items.map(({ l, s }, i) => (
                  <th key={l.id}>
                    <div className="rankline">
                      <span className="rankno">#{i + 1}</span>
                      <span className="rankscore" style={{ background: scoreColor(s.total) }}>
                        {s.total}
                      </span>
                    </div>
                    {l.images[0] && <img className="cmpthumb" src={l.images[0]} alt="" />}
                    <div className="cmptitle">{l.title}</div>
                    <div className="cmpsrc">
                      <span className="badge gray">{l.source}</span>
                      {l.sample && <span className="badge amber">{t('sampleBadge', lang)}</span>}
                    </div>
                    <div className="cmpactions">
                      <a className="btn ghost xs" href={l.sourceUrl} target="_blank" rel="noreferrer">
                        {t('viewSource', lang)} ↗
                      </a>
                      <a className="btn ghost xs" href={mapsHref(l)} target="_blank" rel="noreferrer">
                        🗺 Maps ↗
                      </a>
                      <button className="btn xs" onClick={() => openDetail(l.id)}>
                        {t('openDetail', lang)}
                      </button>
                      <button className="btn ghost xs" onClick={() => toggleCompare(l.id)}>
                        remove
                      </button>
                    </div>
                    <details className="cmpmore">
                      <summary>{t('moreDetails', lang)}</summary>
                      <div className="cmpmorebody">
                        {l.description && <p>{l.description}</p>}
                        <p>
                          <b>{t('posted', lang)}:</b> {new Date(l.postedDate).toLocaleDateString()}
                          <br />
                          <b>{t('contact', lang)}:</b> {[l.contactName, l.contactPhone].filter(Boolean).join(' · ') || '—'}
                          <br />
                          <b>{t('landTitle', lang)}:</b> {l.landTitleType}
                          <br />
                          <b>{t('appraisalSource', lang)}:</b> {appraisalSourceCell(l, lang)}
                        </p>
                        <p>
                          <b>{t('allOffers', lang)}:</b>
                        </p>
                        <div className="offers">
                          {offersOf(l).map((o, k) => (
                            <a key={k} href={o.sourceUrl} target="_blank" rel="noreferrer" className={k === 0 ? 'cheap' : ''}>
                              {k === 0 ? '⬇ ' : ''}
                              {o.source} — {baht(o.priceThb)} · {baht(o.pricePerSqwahThb)}
                              {t('perSqwah', lang)} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    </details>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sections.map((sec) => (
                <SectionRows key={sec.title} section={sec} items={items} bestIdx={bestIdx} />
              ))}

              <tr className="sectionrow">
                <td colSpan={items.length + 1}>{t('sec_scores', lang)}</td>
              </tr>
              {FACTOR_KEYS.map((k) => {
                let bi = -1;
                let val = -Infinity;
                items.forEach(({ s }, i) => {
                  if (s.factors[k] > val) {
                    val = s.factors[k];
                    bi = i;
                  }
                });
                return (
                  <tr key={k}>
                    <td>{t('factor_' + k, lang)}</td>
                    {items.map(({ s }, i) => (
                      <td key={i} className={i === bi ? 'best' : ''}>
                        <div className="barcell">
                          <span
                            className="bar"
                            style={{ width: `${(s.factors[k] / 100) * 80}px`, background: scoreColor(s.factors[k]) }}
                          />
                          {Math.round(s.factors[k])}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr className="totalrow">
                <td>{t('totalScore', lang)}</td>
                {items.map(({ l, s }, i) => (
                  <td key={l.id} className={i === 0 ? 'best' : ''} style={{ color: scoreColor(s.total) }}>
                    {s.total}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  items,
  bestIdx,
}: {
  section: Section;
  items: { l: Listing }[];
  bestIdx: (r: RowDef) => number;
}) {
  return (
    <>
      <tr className="sectionrow">
        <td colSpan={items.length + 1}>{section.title}</td>
      </tr>
      {section.rows.map((r) => {
        const bi = bestIdx(r);
        return (
          <tr key={r.label}>
            <td>{r.label}</td>
            {items.map(({ l }, i) => (
              <td key={l.id} className={i === bi ? 'best' : ''}>
                {r.render(l)}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function appraisalSourceCell(l: Listing, lang: 'en' | 'th'): ReactNode {
  if (l.appraisal.method === 'treasury.go.th') {
    return (
      <a href="https://assessprice.treasury.go.th/" target="_blank" rel="noreferrer">
        treasury.go.th ↗
      </a>
    );
  }
  if (l.appraisal.method === 'sample-data') return lang === 'th' ? 'ประมาณการตัวอย่าง' : 'sample estimate';
  return lang === 'th' ? 'ประมาณการ (heuristic)' : 'heuristic estimate';
}

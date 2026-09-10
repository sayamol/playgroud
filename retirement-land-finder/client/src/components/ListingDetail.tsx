import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useScoreContext } from '../derived';
import { api } from '../api';
import { t } from '../i18n';
import { baht, km, loc, pct, hrs } from '../lib/format';
import { score, scoreColor, FACTOR_KEYS } from '../lib/scoring';
import { estimateAllInCost } from '../lib/cost';
import { hasRealSourceUrl, mapsHref } from '../lib/links';
import type { AppraisalInfo, Weights } from '../types';

export function ListingDetail() {
  const lang = useStore((s) => s.lang);
  const listings = useStore((s) => s.listings);
  const selectedId = useStore((s) => s.selectedId);
  const weights = useStore((s) => s.weights);
  const compareIds = useStore((s) => s.compareIds);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const ctx = useScoreContext();

  const [live, setLive] = useState<AppraisalInfo | null | 'loading' | 'none'>(null);
  useEffect(() => {
    setLive(null);
  }, [selectedId]);

  const l = listings.find((x) => x.id === selectedId);
  if (!l) {
    return (
      <div className="panel">
        <p className="muted">
          {lang === 'th'
            ? 'เลือกที่ดินจากรายการหรือแผนที่เพื่อดูรายละเอียด ราคาประเมินราชการ และคะแนน'
            : 'Select a parcel from the list or map to see full detail, live government appraisal, and its score.'}
        </p>
      </div>
    );
  }

  const s = score(l, weights, ctx);
  const a = l.appraisal;

  return (
    <div className="panel detail">
      <h2>{l.title}</h2>
      <div className="muted">
        {l.source}
        {l.sample ? ` · ${t('sampleBadge', lang)}` : ''} · {l.landTitleType}
        {a.tumbon && ` · ${a.tumbon} ${a.amphur ?? ''} ${a.changwat ?? ''}`}
      </div>

      {l.images.length > 0 && (
        <div className="gallery">
          {l.images.slice(0, 2).map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      )}

      <div className="statgrid">
        <div className="stat">
          <div className="l">{lang === 'th' ? 'ราคา' : 'Asking price'}</div>
          <div className="n">{baht(l.priceThb, { compact: true })}</div>
        </div>
        <div className="stat">
          <div className="l">{baht(l.pricePerSqwahThb)} {t('perSqwah', lang)}</div>
          <div className="n">
            {l.areaRai} {t('rai', lang)}
          </div>
        </div>
        <div className="stat">
          <div className="l">
            {t('govAppraisal', lang)} ({a.method === 'treasury.go.th' ? 'treasury.go.th' : 'est.'})
          </div>
          <div className="n">{a.perSqwahThb ? `${baht(a.perSqwahThb)} ${t('perSqwah', lang)}` : '—'}</div>
        </div>
        <div className="stat">
          <div className="l">{t('askVsAppraisal', lang)}</div>
          <div className="n" style={{ color: l.valueRatio && l.valueRatio < 1 ? 'var(--good)' : 'var(--warn)' }}>
            {l.valueRatio == null
              ? '—'
              : l.valueRatio < 1
                ? `${Math.round((1 - l.valueRatio) * 100)}% ${t('belowAppraisal', lang)}`
                : `${Math.round((l.valueRatio - 1) * 100)}% ${t('aboveAppraisal', lang)}`}
          </div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 2 }}>
        {a.note}
        {a.chanoteNo ? ` · Chanote ${a.chanoteNo}` : ''}
        {a.parcelLandArea ? ` · parcel ${a.parcelLandArea}` : ''}
      </p>

      <div style={{ marginTop: 6 }}>
        <button
          className="btn"
          disabled={live === 'loading'}
          onClick={async () => {
            setLive('loading');
            try {
              const r = await api.appraisal(l.lat, l.lng, l.landAreaSqm, a.changwat ?? undefined);
              setLive(r.appraisal ?? 'none');
            } catch {
              setLive('none');
            }
          }}
        >
          🇹🇭 {t('liveAppraisal', lang)}
        </button>
        {live === 'loading' && <span className="muted"> {t('loading', lang)}</span>}
        {live === 'none' && (
          <span className="muted">
            {' '}
            — {lang === 'th' ? 'ไม่พบแปลงที่ดินของราชการ ณ จุดนี้' : 'no government parcel found at this exact point'}
          </span>
        )}
        {live && typeof live === 'object' && (
          <div className="stat" style={{ marginTop: 6 }}>
            <div className="l">
              treasury.go.th · {live.changwat ?? ''} {live.amphur ?? ''} {live.tumbon ?? ''}
              {live.chanoteNo ? ` · Chanote ${live.chanoteNo}` : ''}
            </div>
            <div className="n">
              {live.perSqwahThb ? `${baht(live.perSqwahThb)} ${t('perSqwah', lang)}` : '—'}
              {live.totalThb ? `  ·  ${baht(live.totalThb, { compact: true })} total` : ''}
            </div>
          </div>
        )}
      </div>

      {(() => {
        const c = estimateAllInCost(l.priceThb, { appraisedTotalThb: a.totalThb });
        const headroom = ctx.budgetThb - c.allInThb;
        return (
          <div className="statgrid" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="l">{t('allInCost', lang)}</div>
              <div className="n">{baht(c.allInThb, { compact: true })}</div>
            </div>
            <div className="stat">
              <div className="l">
                {headroom >= 0 ? t('budgetHeadroom', lang) : t('overBudgetBy', lang)}
              </div>
              <div
                className="n"
                style={{ color: headroom >= 0 ? 'var(--good)' : 'var(--bad)' }}
              >
                {baht(Math.abs(headroom), { compact: true })}
              </div>
            </div>
            <div className="stat">
              <div className="l">{t('transferFee', lang)} · {t('businessTax', lang)}</div>
              <div className="n">
                {baht(c.transferFeeThb, { compact: true })} · {baht(c.businessTaxThb, { compact: true })}
              </div>
            </div>
            <div className="stat">
              <div className="l">{t('legalMisc', lang)} · {t('yourShare', lang)}</div>
              <div className="n">
                {baht(c.legalMiscThb, { compact: true })} · {baht(c.govFeesBuyerThb, { compact: true })}
              </div>
            </div>
          </div>
        );
      })()}
      <p className="muted" style={{ marginTop: 2 }}>{t('allInCostHint', lang)}</p>

      <h3 style={{ marginTop: 12 }}>{t('distances', lang)}</h3>
      <div className="kv">
        <span className="k">🏥 {t('hospital', lang)}</span>
        <span className="v">{km(l.nearestHospital.km)} · {loc(l.nearestHospital.name, lang)}</span>
        <span className="k">🛍 {t('mall', lang)}</span>
        <span className="v">{km(l.nearestMall.km)} · {loc(l.nearestMall.name, lang)}</span>
        <span className="k">🥬 {t('market', lang)}</span>
        <span className="v">{km(l.nearestMarket.km)} · {loc(l.nearestMarket.name, lang)}</span>
        <span className="k">🌳 {t('nature', lang)}</span>
        <span className="v">{km(l.nearestNature.km)} · {loc(l.nearestNature.name, lang)}</span>
        <span className="k">✈️ {t('airport', lang)}</span>
        <span className="v">{km(l.nearestAirport.km)} · {loc(l.nearestAirport.name, lang)}</span>
        <span className="k">🚗 {t('fromBangkok', lang)}</span>
        <span className="v">
          {Math.round(l.bangkokKm)} km · ~{hrs(l.bangkokDriveMin)}
        </span>
      </div>

      <h3 style={{ marginTop: 12 }}>{t('investment', lang)}</h3>
      <div className="kv">
        <span className="k">{t('appreciation', lang)}</span>
        <span className="v">{pct(l.areaAppreciationPct)}</span>
        <span className="k">{t('rentalYield', lang)}</span>
        <span className="v">{pct(l.rentalYieldPct)}</span>
        <span className="k">5-yr projected value*</span>
        <span className="v">
          {baht(l.priceThb * Math.pow(1 + l.areaAppreciationPct / 100, 5), { compact: true })}
        </span>
      </div>
      <p className="muted">*simple compounding of the area price trend, illustration only.</p>

      {l.dupCount > 1 && (
        <>
          <h3 style={{ marginTop: 12 }}>{t('duplicates', lang)}</h3>
          <div className="dup">
            {l.isCheapestInGroup ? (
              <b>✓ {t('cheapestHere', lang)}</b>
            ) : (
              <b>
                {t('couldSave', lang)} {baht(l.potentialSavingThb, { compact: true })}
              </b>
            )}
            <table>
              <tbody>
                <tr>
                  <td>
                    <b>{l.source}</b> (this)
                  </td>
                  <td style={{ textAlign: 'right' }}>{baht(l.priceThb)}</td>
                  <td style={{ textAlign: 'right' }}>{baht(l.pricePerSqwahThb)}{t('perSqwah', lang)}</td>
                </tr>
                {l.otherOffers.map((o) => (
                  <tr key={o.listingId}>
                    <td>
                      {l.sample ? (
                        o.source
                      ) : (
                        <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                          {o.source} ↗
                        </a>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{baht(o.priceThb)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {baht(o.pricePerSqwahThb)}
                      {t('perSqwah', lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 style={{ marginTop: 12 }}>
        {t('totalScore', lang)}:{' '}
        <span style={{ color: scoreColor(s.total), fontSize: 18 }}>{s.total}</span>
      </h3>
      {FACTOR_KEYS.map((k) => (
        <div className="wrow" key={k} style={{ gridTemplateColumns: '120px 1fr 34px' }}>
          <span>{t('factor_' + k, lang)}</span>
          <span style={{ background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
            <span
              style={{
                display: 'block',
                height: 8,
                width: `${s.factors[k]}%`,
                background: scoreColor(s.factors[k]),
              }}
            />
          </span>
          <b style={{ textAlign: 'right' }}>{Math.round(s.factors[k])}</b>
        </div>
      ))}
      <p className="muted">
        weights: {FACTOR_KEYS.map((k) => `${t('factor_' + k, lang)} ${weights[k as keyof Weights]}`).join(' · ')}
      </p>

      <div className="row-actions">
        <button
          className={compareIds.includes(l.id) ? 'btn primary' : 'btn'}
          onClick={() => toggleCompare(l.id)}
        >
          {compareIds.includes(l.id) ? `✓ ${t('inCompare', lang)}` : `+ ${t('addCompare', lang)}`}
        </button>
        {hasRealSourceUrl(l) ? (
          <a className="btn ghost" href={l.sourceUrl} target="_blank" rel="noreferrer">
            {t('viewSource', lang)} ↗
          </a>
        ) : (
          <a
            className="btn ghost"
            href={mapsHref(l.lat, l.lng)}
            target="_blank"
            rel="noreferrer"
            title={t('sampleNoSource', lang)}
          >
            🗺 {t('viewLocation', lang)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

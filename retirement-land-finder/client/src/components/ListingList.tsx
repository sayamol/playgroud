import { useStore } from '../store';
import { useDerived, useScoreContext } from '../derived';
import { t } from '../i18n';
import { baht, km, loc } from '../lib/format';
import { scoreColor } from '../lib/scoring';
import { exportListings } from '../lib/excel';
import { estimateAllInCost } from '../lib/cost';
import type { SortKey } from '../store';
import type { Scored } from '../derived';

export function ListingList() {
  const lang = useStore((s) => s.lang);
  const sort = useStore((s) => s.sort);
  const setSort = useStore((s) => s.setSort);
  const selectedId = useStore((s) => s.selectedId);
  const setSelected = useStore((s) => s.setSelected);
  const compareIds = useStore((s) => s.compareIds);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const listings = useStore((s) => s.listings);
  const weights = useStore((s) => s.weights);
  const loading = useStore((s) => s.loading);
  const regionsData = useStore((s) => s.regionsData);
  const flash = useStore((s) => s.flash);
  const useAllInCost = useStore((s) => s.filters.useAllInCost);
  const budgetThb = useStore((s) => s.filters.budgetThb);
  const ctx = useScoreContext();
  const { scored, filteredCount, overBudgetCount } = useDerived();

  const doExport = async () => {
    try {
      await exportListings({
        all: scored.map((s) => s.listing),
        compared: listings.filter((l) => compareIds.includes(l.id)),
        weights,
        ctx,
        lang,
      });
      flash(
        lang === 'th'
          ? `ส่งออก ${scored.length} รายการเป็น Excel แล้ว`
          : `Exported ${scored.length} listings to Excel`,
      );
    } catch {
      flash(lang === 'th' ? 'ส่งออกไม่สำเร็จ' : 'Excel export failed');
    }
  };

  const regionLabel = (id: string) => {
    const r = regionsData?.regions.find((x) => x.id === id);
    return r ? loc(r.name, lang) : id;
  };

  return (
    <div>
      <div className="list-head">
        <span className="count">
          {filteredCount} {t('results', lang)}
        </span>
        <button className="btn accent" onClick={doExport} disabled={!scored.length}>
          ⬇ {t('exportXlsx', lang)}
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="score">{t('sortBy', lang)}: {t('score', lang)}</option>
          <option value="price">{t('priceLow', lang)}</option>
          <option value="bangkok">{t('bkkNear', lang)}</option>
          <option value="nature">{t('natureNear', lang)}</option>
        </select>
      </div>

      {overBudgetCount > 0 && (
        <div className="overbudget">
          {lang === 'th'
            ? `อีก ${overBudgetCount} แปลงอยู่เหนือขีดงบ — เลื่อนสไลเดอร์งบขึ้นเพื่อดู`
            : `${overBudgetCount} more parcel(s) above your budget — raise the budget slider to see them`}
        </div>
      )}

      {loading && <div className="spin">{t('loading', lang)}</div>}
      {!loading && !scored.length && <div className="spin">{t('none', lang)}</div>}

      {scored.map(({ listing: l, total }: Scored) => (
        <div
          key={l.id}
          className={`lcard ${l.id === selectedId ? 'sel' : ''}`}
          onClick={() => setSelected(l.id)}
        >
          <div className="scorepill" style={{ background: scoreColor(total) }}>
            {Math.round(total)}
          </div>
          <div className="top">
            {l.images[0] && <img className="thumb" src={l.images[0]} alt="" />}
            <div style={{ flex: 1, paddingRight: 44 }}>
              <div className="title">{l.title}</div>
              <div className="price">{baht(l.priceThb, { compact: true })}</div>
              <div className="meta">
                {l.areaRai} {t('rai', lang)} · {baht(l.pricePerSqwahThb)} {t('perSqwah', lang)} ·{' '}
                {regionLabel(l.regionId)}
              </div>
              <div className="meta">
                🏥 {km(l.nearestHospital.km)} · 🌳 {km(l.nearestNature.km)} · 🚗{' '}
                {Math.round(l.bangkokDriveMin / 60)}h {t('fromBangkok', lang)}
              </div>
              {useAllInCost &&
                (() => {
                  const allIn = estimateAllInCost(l.priceThb, {
                    appraisedTotalThb: l.appraisal.totalThb,
                  }).allInThb;
                  const headroom = budgetThb - allIn;
                  return (
                    <div className="meta">
                      💰 {t('allInCost', lang)} {baht(allIn, { compact: true })} ·{' '}
                      <span style={{ color: headroom >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                        {headroom >= 0 ? t('budgetHeadroom', lang) : t('overBudgetBy', lang)}{' '}
                        {baht(Math.abs(headroom), { compact: true })}
                      </span>
                    </div>
                  );
                })()}
            </div>
          </div>

          <div className="badges">
            <span className="badge gray">{l.source}</span>
            {l.sample && <span className="badge amber">{t('sampleBadge', lang)}</span>}
            {l.appraisal.method === 'treasury.go.th' && (
              <span className="badge green">gov appraisal ✓</span>
            )}
            {l.valueRatio != null && l.valueRatio < 1 && (
              <span className="badge green">
                {Math.round((1 - l.valueRatio) * 100)}% {t('belowAppraisal', lang)}
              </span>
            )}
            {l.valueRatio != null && l.valueRatio >= 1.15 && (
              <span className="badge amber">
                {Math.round((l.valueRatio - 1) * 100)}% {t('aboveAppraisal', lang)}
              </span>
            )}
            {l.dupCount > 1 && (
              <span className="badge pink">
                {l.isCheapestInGroup
                  ? `${t('cheapestHere', lang)} · ${l.dupCount}×`
                  : `+${baht(l.potentialSavingThb, { compact: true })} vs cheapest`}
              </span>
            )}
          </div>

          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className={compareIds.includes(l.id) ? 'btn primary' : 'btn'}
              onClick={() => toggleCompare(l.id)}
            >
              {compareIds.includes(l.id) ? `✓ ${t('inCompare', lang)}` : `+ ${t('addCompare', lang)}`}
            </button>
            <a className="btn ghost" href={l.sourceUrl} target="_blank" rel="noreferrer">
              {t('viewSource', lang)} ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

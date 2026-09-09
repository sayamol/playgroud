import type { Lang, Listing, Weights } from '../types';
import { score, FACTOR_KEYS, type ScoreContext } from './scoring';
import { estimateAllInCost } from './cost';
import { loc } from './format';
import { t } from '../i18n';

function row(l: Listing, weights: Weights, ctx: ScoreContext, lang: Lang) {
  const s = score(l, weights, ctx);
  const cost = estimateAllInCost(l.priceThb, { appraisedTotalThb: l.appraisal.totalThb });
  return {
    ID: l.id,
    Title: l.title,
    Region: l.regionId,
    Source: l.source,
    'Source URL': l.sourceUrl,
    'Price (THB)': l.priceThb,
    'Price / sq wah': l.pricePerSqwahThb,
    'Area (rai)': l.areaRai,
    'Area (sq wah)': l.areaSqwah,
    'Land title': l.landTitleType,
    'Govt appraisal / sq wah': l.appraisal.perSqwahThb ?? '',
    'Govt appraisal total': l.appraisal.totalThb ?? '',
    'Appraisal source': l.appraisal.method,
    'Asking / appraisal': l.valueRatio ?? '',
    'All-in cost (THB)': cost.allInThb,
    'Transfer fee (THB)': cost.transferFeeThb,
    'SBT/stamp duty (THB)': cost.businessTaxThb,
    'Legal/misc (THB)': cost.legalMiscThb,
    'Buyer gov-fee share (THB)': cost.govFeesBuyerThb,
    'Budget headroom (THB)': Math.round(ctx.budgetThb - cost.allInThb),
    'Chanote no.': l.appraisal.chanoteNo ?? '',
    'Tambon': l.appraisal.tumbon ?? '',
    'Amphoe': l.appraisal.amphur ?? '',
    'Changwat': l.appraisal.changwat ?? '',
    'From Bangkok (km)': l.bangkokKm,
    'From Bangkok (drive min)': l.bangkokDriveMin,
    'Hospital (km)': round(l.nearestHospital.km),
    'Hospital name': loc(l.nearestHospital.name, lang),
    'Dept store (km)': round(l.nearestMall.km),
    'Dept store name': loc(l.nearestMall.name, lang),
    'Market (km)': round(l.nearestMarket.km),
    'Nature (km)': round(l.nearestNature.km),
    'Nature name': loc(l.nearestNature.name, lang),
    'Airport (km)': round(l.nearestAirport.km),
    'Area trend %/yr': l.areaAppreciationPct,
    'Rental yield %': l.rentalYieldPct,
    'Duplicate listings': l.dupCount,
    'Cheapest of duplicates': l.isCheapestInGroup ? 'yes' : 'no',
    'Cheapest price (THB)': l.cheapestPriceThb,
    'Potential saving (THB)': l.potentialSavingThb,
    'Other offers': l.otherOffers
      .map((o) => `${o.source}: ${o.priceThb} (${o.sourceUrl})`)
      .join(' | '),
    ...Object.fromEntries(
      FACTOR_KEYS.map((k) => [`Score: ${t('factor_' + k, lang)}`, Math.round(s.factors[k])]),
    ),
    'TOTAL SCORE': s.total,
  };
}

function round(n: number) {
  return Number.isNaN(n) ? '' : Math.round(n * 10) / 10;
}

export async function exportListings(opts: {
  all: Listing[];
  compared: Listing[];
  weights: Weights;
  ctx: ScoreContext;
  lang: Lang;
}) {
  // xlsx is ~150 kB gzipped — only pull it in when the user actually exports
  const XLSX = await import('xlsx');
  const { all, compared, weights, ctx, lang } = opts;
  const wb = XLSX.utils.book_new();

  const allRows = [...all]
    .map((l) => ({ l, s: score(l, weights, ctx).total }))
    .sort((a, b) => b.s - a.s)
    .map(({ l }) => row(l, weights, ctx, lang));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(allRows),
    'All results',
  );

  if (compared.length) {
    const cmpRows = [...compared]
      .map((l) => ({ l, s: score(l, weights, ctx).total }))
      .sort((a, b) => b.s - a.s)
      .map(({ l }, i) => ({ Rank: i + 1, ...row(l, weights, ctx, lang) }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(cmpRows),
      'Comparison',
    );
  }

  const wRows = Object.entries(weights).map(([k, v]) => ({
    Factor: t('factor_' + k, lang),
    Weight: v,
  }));
  wRows.push({ Factor: 'Budget (THB)', Weight: ctx.budgetThb });
  wRows.push({ Factor: 'Score vs all-in cost', Weight: ctx.useAllInCost ? 1 : 0 });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wRows), 'Scoring setup');

  // Duplicate groups summary
  const groups = new Map<string, Listing[]>();
  for (const l of all) {
    if (l.dupCount <= 1) continue;
    const arr = groups.get(l.dupGroupId) ?? [];
    arr.push(l);
    groups.set(l.dupGroupId, arr);
  }
  const dupRows: Record<string, unknown>[] = [];
  for (const [gid, ls] of groups) {
    const sorted = [...ls].sort((a, b) => a.priceThb - b.priceThb);
    sorted.forEach((l, i) => {
      dupRows.push({
        Group: gid,
        '#': i + 1,
        Source: l.source,
        'Price (THB)': l.priceThb,
        'Price / sq wah': l.pricePerSqwahThb,
        Cheapest: i === 0 ? 'yes' : '',
        'Diff vs cheapest': l.priceThb - sorted[0].priceThb,
        URL: l.sourceUrl,
      });
    });
  }
  if (dupRows.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(dupRows),
      'Duplicate groups',
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `retirement-land-${date}.xlsx`);
}

import { useStore } from '../store';
import { t } from '../i18n';
import { baht, loc } from '../lib/format';
import type { RegionId, SourceId } from '../types';

const REGION_IDS: RegionId[] = ['khaoyai', 'huahin', 'chiangmai', 'bkknat'];
const SOURCE_IDS: SourceId[] = ['ddproperty', 'kaidee', 'baania'];

export function Filters() {
  const lang = useStore((s) => s.lang);
  const f = useStore((s) => s.filters);
  const patch = useStore((s) => s.patchFilter);
  const toggleRegion = useStore((s) => s.toggleRegion);
  const toggleSource = useStore((s) => s.toggleSource);
  const resetFilters = useStore((s) => s.resetFilters);
  const regionsData = useStore((s) => s.regionsData);

  const regionName = (id: RegionId) =>
    regionsData?.regions.find((r) => r.id === id)?.name
      ? loc(regionsData!.regions.find((r) => r.id === id)!.name, lang)
      : id;

  return (
    <div className="panel">
      <h3>{t('filters', lang)}</h3>

      <div className="field">
        <label>
          {t('budget', lang)}: <span className="val">{baht(f.budgetThb, { compact: true })}</span>
        </label>
        <input
          type="range"
          min={300000}
          max={5000000}
          step={100000}
          value={f.budgetThb}
          onChange={(e) => patch('budgetThb', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>{t('regions', lang)}</label>
        <div className="chips">
          {REGION_IDS.map((id) => (
            <button
              key={id}
              className={`chip r-${id} ${f.regions.has(id) ? 'on' : ''}`}
              onClick={() => toggleRegion(id)}
            >
              {regionName(id)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t('sources', lang)}</label>
        <div className="chips">
          {SOURCE_IDS.map((id) => (
            <button
              key={id}
              className={`chip src ${f.sources.has(id) ? 'on' : ''}`}
              onClick={() => toggleSource(id)}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          {t('maxBkk', lang)}: <span className="val">{f.maxBangkokHrs}h</span>
        </label>
        <input
          type="range"
          min={1}
          max={16}
          step={0.5}
          value={f.maxBangkokHrs}
          onChange={(e) => patch('maxBangkokHrs', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>
          {t('maxHospital', lang)}: <span className="val">{f.maxHospitalKm} km</span>
        </label>
        <input
          type="range"
          min={2}
          max={60}
          step={1}
          value={f.maxHospitalKm}
          onChange={(e) => patch('maxHospitalKm', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>
          {t('maxNature', lang)}: <span className="val">{f.maxNatureKm} km</span>
        </label>
        <input
          type="range"
          min={2}
          max={60}
          step={1}
          value={f.maxNatureKm}
          onChange={(e) => patch('maxNatureKm', Number(e.target.value))}
        />
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={f.onlyCheapest}
          onChange={(e) => patch('onlyCheapest', e.target.checked)}
        />
        {t('onlyCheapest', lang)}
      </label>

      <label className="toggle" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={f.includeSample}
          onChange={(e) => patch('includeSample', e.target.checked)}
        />
        {lang === 'th' ? 'รวมข้อมูลตัวอย่าง' : 'Include sample data'}
      </label>

      <label className="toggle" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={f.useAllInCost}
          onChange={(e) => patch('useAllInCost', e.target.checked)}
        />
        {t('scoreAllIn', lang)}
      </label>
      <p className="muted" style={{ marginTop: 4 }}>
        {t('allInCostHint', lang)}
      </p>

      <button className="btn ghost" style={{ marginTop: 12, width: '100%' }} onClick={resetFilters}>
        ↺ {lang === 'th' ? 'รีเซ็ตตัวกรอง' : 'Reset filters'}
      </button>
    </div>
  );
}

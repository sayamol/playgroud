import { useStore } from '../store';
import { t } from '../i18n';
import { FACTOR_KEYS } from '../lib/scoring';
import type { Weights } from '../types';

export function WeightsPanel() {
  const lang = useStore((s) => s.lang);
  const weights = useStore((s) => s.weights);
  const setWeight = useStore((s) => s.setWeight);
  const resetWeights = useStore((s) => s.resetWeights);

  return (
    <div className="panel">
      <h3>{t('weights', lang)}</h3>
      <p className="muted" style={{ marginTop: -4 }}>
        {t('weightsHint', lang)}
      </p>
      {FACTOR_KEYS.map((k) => (
        <div className="wrow" key={k}>
          <span>{t('factor_' + k, lang)}</span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={weights[k as keyof Weights]}
            onChange={(e) => setWeight(k as keyof Weights, Number(e.target.value))}
          />
          <b style={{ textAlign: 'right' }}>{weights[k as keyof Weights]}</b>
        </div>
      ))}
      <button className="btn ghost" style={{ marginTop: 6 }} onClick={resetWeights}>
        ↺ reset
      </button>
    </div>
  );
}

import { useStore } from '../store';
import { t } from '../i18n';

export function Header() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const load = useStore((s) => s.load);
  const runScrape = useStore((s) => s.runScrape);
  const resetSeedData = useStore((s) => s.resetSeedData);
  const copyShareLink = useStore((s) => s.copyShareLink);
  const crawler = useStore((s) => s.crawler);
  const loading = useStore((s) => s.loading);

  return (
    <header className="header">
      <div>
        <h1>🏡 {t('appTitle', lang)}</h1>
        <div className="sub">{t('appSub', lang)}</div>
      </div>
      <div className="spacer" />

      <div className="pill" title="Government appraisal is fetched live from treasury.go.th">
        <span>🇹🇭 {t('govAppraisal', lang)}: live</span>
      </div>
      <div className="pill">
        <span>
          {crawler?.enabled ? '🟢 crawler on' : `🔴 ${t('crawlerOff', lang)}`}
        </span>
        <button onClick={() => runScrape()} disabled={loading}>
          {t('runScrape', lang)}
        </button>
        <button onClick={() => load(true)} disabled={loading}>
          ⟳ {t('refresh', lang)}
        </button>
        <button
          onClick={() => {
            if (window.confirm(t('resetSeedConfirm', lang))) resetSeedData();
          }}
          disabled={loading}
        >
          ↺ {t('resetSeed', lang)}
        </button>
        <button onClick={() => copyShareLink()}>🔗 {t('copyShareLink', lang)}</button>
      </div>

      <div className="lang">
        <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
          EN
        </button>
        <button className={lang === 'th' ? 'active' : ''} onClick={() => setLang('th')}>
          ไทย
        </button>
      </div>
    </header>
  );
}

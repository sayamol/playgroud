import { useEffect } from 'react';
import { useStore } from './store';
import { t } from './i18n';
import { Header } from './components/Header';
import { Filters } from './components/Filters';
import { WeightsPanel } from './components/WeightsPanel';
import { MapPanel } from './components/MapPanel';
import { ListingList } from './components/ListingList';
import { ListingDetail } from './components/ListingDetail';
import { CompareModal } from './components/CompareModal';

export function App() {
  const lang = useStore((s) => s.lang);
  const load = useStore((s) => s.load);
  const error = useStore((s) => s.error);
  const busyMsg = useStore((s) => s.busyMsg);
  const listings = useStore((s) => s.listings);
  const compareIds = useStore((s) => s.compareIds);
  const setShowCompare = useStore((s) => s.setShowCompare);
  const setSelected = useStore((s) => s.setSelected);
  const clearCompare = useStore((s) => s.clearCompare);
  const toggleCompare = useStore((s) => s.toggleCompare);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="app">
      <Header />
      {error && <div className="err">⚠ {error}</div>}

      <div className="body">
        <div className="col left">
          <Filters />
          <WeightsPanel />
        </div>

        <div className="col center">
          <MapPanel />
          {compareIds.length > 0 && (
            <div className="comparebar">
              <div className="dots">
                {compareIds.map((id, i) => {
                  const l = listings.find((x) => x.id === id);
                  return (
                    <span
                      className="dot"
                      key={id}
                      title={l?.title ?? id}
                      onClick={() => l && setSelected(l.id)}
                    >
                      {i + 1}
                      <button
                        className="dot-x"
                        title={t('clear', lang)}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(id);
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <button className="btn primary" onClick={() => setShowCompare(true)}>
                ⚖️ {t('compareSelected', lang)} ({compareIds.length})
              </button>
              <button className="btn ghost" onClick={clearCompare}>
                {t('clear', lang)}
              </button>
            </div>
          )}
        </div>

        <div className="col right">
          <ListingList />
          <ListingDetail />
        </div>
      </div>

      <CompareModal />
      {busyMsg && <div className="toast">{busyMsg}</div>}
    </div>
  );
}

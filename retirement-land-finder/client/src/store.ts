import { create } from 'zustand';
import { api } from './api';
import type {
  CrawlerStatus,
  Lang,
  Listing,
  RegionId,
  RegionsPayload,
  SourceId,
  Weights,
} from './types';
import { DEFAULT_WEIGHTS } from './lib/scoring';
import { decodeShareState, encodeShareState, shareUrl } from './lib/share';

export type SortKey = 'score' | 'price' | 'bangkok' | 'nature';

interface Filters {
  budgetThb: number;
  regions: Set<RegionId>;
  sources: Set<SourceId>;
  maxBangkokHrs: number;
  maxHospitalKm: number;
  maxNatureKm: number;
  onlyCheapest: boolean;
  includeSample: boolean;
  /** compare asking price + estimated transaction costs against the budget */
  useAllInCost: boolean;
}

interface State {
  lang: Lang;
  loading: boolean;
  error: string | null;
  regionsData: RegionsPayload | null;
  listings: Listing[];
  crawler: CrawlerStatus | null;

  filters: Filters;
  sort: SortKey;
  weights: Weights;

  compareIds: string[];
  selectedId: string | null;
  showCompare: boolean;
  busyMsg: string | null;

  setLang: (l: Lang) => void;
  load: (refresh?: boolean) => Promise<void>;
  patchFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  toggleRegion: (r: RegionId) => void;
  toggleSource: (s: SourceId) => void;
  resetFilters: () => void;
  setSort: (s: SortKey) => void;
  setWeight: (k: keyof Weights, v: number) => void;
  resetWeights: () => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setSelected: (id: string | null) => void;
  setShowCompare: (v: boolean) => void;
  runScrape: () => Promise<void>;
  resetSeedData: () => Promise<void>;
  copyShareLink: () => Promise<void>;
  flash: (msg: string, ms?: number) => void;
}

const ALL_REGIONS: RegionId[] = ['khaoyai', 'huahin', 'chiangmai', 'bkknat'];
const ALL_SOURCES: SourceId[] = ['ddproperty', 'kaidee', 'baania'];

const defaultFilters = (): Filters => ({
  budgetThb: 2_000_000,
  regions: new Set(ALL_REGIONS),
  sources: new Set(ALL_SOURCES),
  maxBangkokHrs: 16,
  maxHospitalKm: 60,
  maxNatureKm: 60,
  onlyCheapest: true,
  includeSample: true,
  useAllInCost: false,
});

// ---- lightweight localStorage persistence (lang / filters / sort / weights) ----
const LS_KEY = 'rlf.ui.v2';

interface Persisted {
  lang?: Lang;
  sort?: SortKey;
  weights?: Weights;
  filters?: Omit<Filters, 'regions' | 'sources'> & { regions: RegionId[]; sources: SourceId[] };
}

function loadPersisted(): Partial<Pick<State, 'lang' | 'sort' | 'weights' | 'filters'>> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Persisted;
    const out: Partial<Pick<State, 'lang' | 'sort' | 'weights' | 'filters'>> = {};
    if (p.lang === 'en' || p.lang === 'th') out.lang = p.lang;
    if (p.sort) out.sort = p.sort;
    if (p.weights) out.weights = { ...DEFAULT_WEIGHTS, ...p.weights };
    if (p.filters) {
      out.filters = {
        ...defaultFilters(),
        ...p.filters,
        regions: new Set(p.filters.regions ?? ALL_REGIONS),
        sources: new Set(p.filters.sources ?? ALL_SOURCES),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function persist(s: State) {
  try {
    const data: Persisted = {
      lang: s.lang,
      sort: s.sort,
      weights: s.weights,
      filters: {
        ...s.filters,
        regions: [...s.filters.regions],
        sources: [...s.filters.sources],
      },
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota — ignore */
  }
}

const persisted = loadPersisted();

// A `?c=` token in the URL (a shared comparison) wins over persisted UI
// state for the fields it carries.
const shared =
  typeof location !== 'undefined'
    ? decodeShareState(new URLSearchParams(location.search).get('c') ?? '')
    : null;

const initialFilters = persisted.filters ?? defaultFilters();
const initialWeights = persisted.weights ?? { ...DEFAULT_WEIGHTS };

export const useStore = create<State>((set, get) => ({
  lang: persisted.lang ?? 'en',
  loading: false,
  error: null,
  regionsData: null,
  listings: [],
  crawler: null,

  filters: {
    ...initialFilters,
    ...(shared?.budgetThb ? { budgetThb: shared.budgetThb } : {}),
    ...(shared ? { useAllInCost: shared.useAllInCost } : {}),
  },
  sort: persisted.sort ?? 'score',
  weights: { ...initialWeights, ...(shared?.weights ?? {}) },

  compareIds: shared?.compareIds ?? [],
  selectedId: null,
  showCompare: false,
  busyMsg: null,

  setLang: (l) => set({ lang: l }),

  load: async (refresh = false) => {
    set({ loading: true, error: null });
    try {
      const [regionsData, payload] = await Promise.all([
        get().regionsData ? Promise.resolve(get().regionsData!) : api.regions(),
        api.listings(refresh),
      ]);
      set({
        regionsData,
        listings: payload.listings,
        crawler: payload.crawler,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  patchFilter: (k, v) => set({ filters: { ...get().filters, [k]: v } }),
  toggleRegion: (r) => {
    const s = new Set(get().filters.regions);
    s.has(r) ? s.delete(r) : s.add(r);
    set({ filters: { ...get().filters, regions: s } });
  },
  toggleSource: (src) => {
    const s = new Set(get().filters.sources);
    s.has(src) ? s.delete(src) : s.add(src);
    set({ filters: { ...get().filters, sources: s } });
  },
  resetFilters: () => set({ filters: defaultFilters() }),
  setSort: (s) => set({ sort: s }),
  setWeight: (k, v) => set({ weights: { ...get().weights, [k]: v } }),
  resetWeights: () => set({ weights: { ...DEFAULT_WEIGHTS } }),

  toggleCompare: (id) => {
    const cur = get().compareIds;
    if (cur.includes(id)) set({ compareIds: cur.filter((x) => x !== id) });
    else if (cur.length < 6) set({ compareIds: [...cur, id] });
    else get().flash('Comparison holds up to 6 parcels');
  },
  clearCompare: () => set({ compareIds: [] }),
  setSelected: (id) => set({ selectedId: id }),
  setShowCompare: (v) => set({ showCompare: v }),

  runScrape: async () => {
    set({ busyMsg: 'Running scrapers… (usually blocked without a proxy)' });
    try {
      const r = await api.scrape();
      await get().load(true);
      const results = (r as { results?: { added?: number }[] }).results ?? [];
      const added = results.reduce((n, x) => n + (x.added ?? 0), 0);
      get().flash(added ? `Scrapers added ${added} listing(s)` : 'Scrapers ran — nothing new (likely blocked)');
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busyMsg: null });
    }
  },

  resetSeedData: async () => {
    set({ busyMsg: 'Resetting to sample data…' });
    try {
      await api.resetSeed();
      set({ compareIds: [], selectedId: null });
      await get().load(true);
      get().flash('Store reset to sample data');
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      if (get().busyMsg === 'Resetting to sample data…') set({ busyMsg: null });
    }
  },

  copyShareLink: async () => {
    const s = get();
    const url = shareUrl(location.origin, location.pathname, {
      compareIds: s.compareIds,
      weights: s.weights,
      budgetThb: s.filters.budgetThb,
      useAllInCost: s.filters.useAllInCost,
    });
    try {
      await navigator.clipboard.writeText(url);
      s.flash('Shareable link copied to clipboard');
    } catch {
      s.flash('Could not copy — link is in the address bar');
    }
  },

  flash: (msg, ms = 2600) => {
    set({ busyMsg: msg });
    window.setTimeout(() => {
      if (get().busyMsg === msg) set({ busyMsg: null });
    }, ms);
  },
}));

// save a slice of state to localStorage whenever it changes
useStore.subscribe((s) => persist(s));

// keep the `?c=` token in the address bar in sync with the current
// comparison, so a copy of the URL at any moment is shareable.
let lastShareKey = '';
useStore.subscribe((s) => {
  if (typeof history === 'undefined') return;
  const key = JSON.stringify([
    s.compareIds,
    s.weights,
    s.filters.budgetThb,
    s.filters.useAllInCost,
  ]);
  if (key === lastShareKey) return;
  lastShareKey = key;
  const params = new URLSearchParams(location.search);
  if (s.compareIds.length) {
    params.set(
      'c',
      encodeShareState({
        compareIds: s.compareIds,
        weights: s.weights,
        budgetThb: s.filters.budgetThb,
        useAllInCost: s.filters.useAllInCost,
      }),
    );
  } else {
    params.delete('c');
  }
  const qs = params.toString();
  history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
});

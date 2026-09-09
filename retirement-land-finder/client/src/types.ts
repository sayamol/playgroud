export type SourceId = 'ddproperty' | 'kaidee' | 'baania' | 'sample';
export type RegionId = 'khaoyai' | 'huahin' | 'chiangmai' | 'bkknat';
export type PoiKind = 'hospital' | 'mall' | 'market' | 'nature' | 'airport';
export type Lang = 'en' | 'th';

export interface LocalizedName {
  en: string;
  th: string;
}

export interface Region {
  id: RegionId;
  province: string;
  name: LocalizedName;
  color: string;
  center: [number, number];
  zoom: number;
}

export interface Poi {
  id: string;
  regionId: RegionId;
  kind: PoiKind;
  name: LocalizedName;
  lat: number;
  lng: number;
}

export interface RegionsPayload {
  bangkok: { lat: number; lng: number; name: LocalizedName };
  regions: Region[];
  pois: Poi[];
}

export interface AppraisalInfo {
  method: 'treasury.go.th' | 'heuristic-model' | 'sample-data';
  perSqwahThb: number | null;
  previousPerSqwahThb?: number | null;
  totalThb: number | null;
  chanoteNo?: number | string | null;
  parcelLandArea?: string | null;
  tumbon?: string | null;
  amphur?: string | null;
  changwat?: string | null;
  note: string;
  fetchedAt: string;
}

export interface NearestPoi {
  km: number;
  name: LocalizedName;
}

export interface DuplicateOffer {
  listingId: string;
  source: SourceId;
  sourceUrl: string;
  priceThb: number;
  pricePerSqwahThb: number;
  scrapedAt: string;
}

export interface Listing {
  id: string;
  source: SourceId;
  sourceUrl: string;
  sourceListingId: string;
  title: string;
  regionId: RegionId;
  lat: number;
  lng: number;
  priceThb: number;
  landAreaSqm: number;
  landTitleType: string;
  postedDate: string;
  scrapedAt: string;
  contactName?: string;
  contactPhone?: string;
  description?: string;
  images: string[];
  sample?: boolean;
  areaAppreciationPct: number;
  rentalYieldPct: number;
  parcelKey?: string;

  areaRai: number;
  areaSqwah: number;
  pricePerSqwahThb: number;
  bangkokKm: number;
  bangkokDriveMin: number;

  nearestHospital: NearestPoi;
  nearestMall: NearestPoi;
  nearestMarket: NearestPoi;
  nearestNature: NearestPoi;
  nearestAirport: NearestPoi;

  appraisal: AppraisalInfo;
  valueRatio: number | null;

  dupGroupId: string;
  dupCount: number;
  isCheapestInGroup: boolean;
  cheapestPriceThb: number;
  potentialSavingThb: number;
  otherOffers: DuplicateOffer[];
}

export interface CrawlerStatus {
  enabled: boolean;
  schedule: string;
  running: boolean;
  proxyConfigured: boolean;
  lastRun: { at: string; results: unknown[] } | null;
}

export interface ListingsPayload {
  listings: Listing[];
  meta: { count: number; lastScrapeAt: string | null; createdAt: string };
  crawler: CrawlerStatus;
}

// ---- scoring ----------------------------------------------------------
export type FactorKey =
  | 'budget'
  | 'value'
  | 'nature'
  | 'facilities'
  | 'bangkok'
  | 'investment'
  | 'size';

export interface Weights {
  budget: number;
  value: number;
  nature: number;
  facilities: number;
  bangkok: number;
  investment: number;
  size: number;
}

export interface ScoreBreakdown {
  factors: Record<FactorKey, number>;
  total: number;
}

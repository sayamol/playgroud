export type SourceId = 'ddproperty' | 'kaidee' | 'baania' | 'sample';
export type RegionId = 'khaoyai' | 'huahin' | 'chiangmai' | 'bkknat';
export type PoiKind = 'hospital' | 'mall' | 'market' | 'nature' | 'airport';

export interface LocalizedName {
  en: string;
  th: string;
}

export interface Poi {
  id: string;
  regionId: RegionId;
  kind: PoiKind;
  name: LocalizedName;
  lat: number;
  lng: number;
}

export interface Region {
  id: RegionId;
  province: string;
  name: LocalizedName;
  color: string;
  center: [number, number];
  zoom: number;
}

/** A listing exactly as captured from a source (or generated as sample). */
export interface RawListing {
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
  landTitleType: string; // "Chanote (Nor Sor 4)" etc.
  postedDate: string; // ISO
  scrapedAt: string; // ISO
  contactName?: string;
  contactPhone?: string;
  description?: string;
  images: string[];
  /** true for generated sample parcels (synthetic coordinates) */
  sample?: boolean;
  /** area annual appreciation %, from source area stats or estimate */
  areaAppreciationPct: number;
  /** indicative gross rental yield %, estimate */
  rentalYieldPct: number;
  /**
   * When several sources list the SAME physical parcel this key is
   * shared, so the de-duplicator can group them with certainty.
   * Real scrapers will not have this; it is used by sample data and
   * by any future "confirmed duplicate" tagging.
   */
  parcelKey?: string;
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

export interface DuplicateOffer {
  listingId: string;
  source: SourceId;
  sourceUrl: string;
  priceThb: number;
  pricePerSqwahThb: number;
  scrapedAt: string;
}

export interface NearestPoi {
  km: number;
  name: LocalizedName;
}

/** A listing enriched with everything the UI needs. */
export interface EnrichedListing extends RawListing {
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
  /** asking / appraised value. < 1 means priced below government appraisal. */
  valueRatio: number | null;

  /** de-dup grouping */
  dupGroupId: string;
  dupCount: number;
  isCheapestInGroup: boolean;
  cheapestPriceThb: number;
  potentialSavingThb: number;
  otherOffers: DuplicateOffer[];
}

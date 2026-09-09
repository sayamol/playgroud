import type { RawListing, RegionId, SourceId } from '../types.js';

export interface ScrapeOptions {
  regionId: RegionId;
  max: number;
  delayMs: number;
}

export interface ScrapeResult {
  source: SourceId;
  regionId: RegionId;
  listings: RawListing[];
  ok: boolean;
  error?: string;
  blocked?: boolean;
}

export interface Scraper {
  id: SourceId;
  label: string;
  /** search-page URL template per region, for reference / manual checks */
  searchUrl(regionId: RegionId): string;
  scrape(opts: ScrapeOptions): Promise<ScrapeResult>;
}

import type { RawListing, RegionId, SourceId } from '../types.js';
import type { ScrapeOptions, ScrapeResult } from './types.js';
import { launchBrowser, looksBlocked, newPage, sleep } from './browser.js';

export interface SiteConfig {
  id: SourceId;
  label: string;
  searchUrl(regionId: RegionId): string;
  /**
   * Runs in Node context with a Playwright `page` already navigated to the
   * search URL. Must return best-effort raw listings. Throw to signal a
   * hard failure; return [] for "nothing found".
   */
  extract(page: any, opts: ScrapeOptions): Promise<Partial<RawListing>[]>;
}

const REGION_CENTER: Record<RegionId, [number, number]> = {
  khaoyai: [14.6, 101.38],
  huahin: [12.5, 99.93],
  chiangmai: [18.83, 98.95],
  bkknat: [14.05, 100.6],
};

/** Fill the gaps a real page rarely gives us, so downstream code is safe. */
export function normalize(
  raw: Partial<RawListing>,
  source: SourceId,
  regionId: RegionId,
  i: number,
): RawListing | null {
  if (!raw.priceThb || raw.priceThb <= 0) return null;
  const [clat, clng] = REGION_CENTER[regionId];
  const sourceListingId =
    raw.sourceListingId || raw.sourceUrl?.split('/').filter(Boolean).pop() || `x${Date.now()}${i}`;
  const areaSqm = raw.landAreaSqm && raw.landAreaSqm > 0 ? raw.landAreaSqm : 1600;
  return {
    id: `${source}-${sourceListingId}`,
    source,
    sourceUrl: raw.sourceUrl || '',
    sourceListingId,
    title: raw.title?.trim() || 'Untitled land listing',
    regionId,
    lat: raw.lat ?? clat,
    lng: raw.lng ?? clng,
    priceThb: Math.round(raw.priceThb),
    landAreaSqm: Math.round(areaSqm),
    landTitleType: raw.landTitleType || 'Unknown',
    postedDate: raw.postedDate || new Date().toISOString(),
    scrapedAt: new Date().toISOString(),
    contactName: raw.contactName,
    contactPhone: raw.contactPhone,
    description: raw.description,
    images: raw.images && raw.images.length ? raw.images : [],
    areaAppreciationPct: raw.areaAppreciationPct ?? 4,
    rentalYieldPct: raw.rentalYieldPct ?? 3.5,
  };
}

export async function runSite(cfg: SiteConfig, opts: ScrapeOptions): Promise<ScrapeResult> {
  const base: ScrapeResult = {
    source: cfg.id,
    regionId: opts.regionId,
    listings: [],
    ok: false,
  };
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await newPage(browser);
    const url = cfg.searchUrl(opts.regionId);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(Math.min(opts.delayMs, 8000));

    const html: string = await page.content();
    if (looksBlocked(html)) {
      return { ...base, ok: false, blocked: true, error: 'Bot check / CAPTCHA page returned' };
    }

    const rawItems = await cfg.extract(page, opts);
    const listings: RawListing[] = [];
    rawItems.slice(0, opts.max).forEach((r, i) => {
      const n = normalize(r, cfg.id, opts.regionId, i);
      if (n) listings.push(n);
    });
    return { ...base, ok: true, listings };
  } catch (err) {
    return { ...base, ok: false, error: (err as Error).message };
  } finally {
    await browser?.close().catch(() => {});
  }
}

import cron from 'node-cron';
import regionsData from './data/regions.json';
import type { Region } from './types.js';
import { SCRAPER_LIST } from './scrapers/registry.js';
import { upsertListings } from './store.js';
import { invalidateEnrichCache } from './enrich.js';
import { sleep } from './scrapers/browser.js';

const REGIONS = regionsData.regions as unknown as Region[];

let running = false;
let lastRun: { at: string; results: any[] } | null = null;

export function crawlerStatus() {
  return {
    enabled: (process.env.ENABLE_CRAWLER || 'false') === 'true',
    schedule: process.env.CRAWLER_CRON || '15 3 * * *',
    running,
    lastRun,
    proxyConfigured: Boolean(process.env.SCRAPER_PROXY_URL),
  };
}

export async function runFullCrawl(): Promise<any[]> {
  if (running) return lastRun?.results || [];
  running = true;
  const delayMs = Number(process.env.SCRAPER_DELAY_MS || 6000);
  const max = Number(process.env.SCRAPER_MAX_PER_RUN || 25);
  const results: any[] = [];
  try {
    for (const scraper of SCRAPER_LIST) {
      for (const region of REGIONS) {
        try {
          const res = await scraper.scrape({ regionId: region.id, max, delayMs });
          let upserted = { added: 0, updated: 0 };
          if (res.ok && res.listings.length) {
            upserted = upsertListings(scraper.id, res.listings);
          }
          results.push({
            source: scraper.id,
            region: region.id,
            ok: res.ok,
            blocked: res.blocked || false,
            error: res.error,
            found: res.listings.length,
            ...upserted,
          });
        } catch (err) {
          results.push({
            source: scraper.id,
            region: region.id,
            ok: false,
            error: (err as Error).message,
          });
        }
        await sleep(delayMs);
      }
    }
    invalidateEnrichCache();
  } finally {
    running = false;
    lastRun = { at: new Date().toISOString(), results };
  }
  return results;
}

export function startCrawler() {
  const enabled = (process.env.ENABLE_CRAWLER || 'false') === 'true';
  const schedule = process.env.CRAWLER_CRON || '15 3 * * *';
  if (!enabled) {
    console.log(
      '[crawler] disabled (ENABLE_CRAWLER!=true). Sample data + live appraisal still work. ' +
        'You can trigger a one-off crawl from POST /api/scrape.',
    );
    return;
  }
  if (!cron.validate(schedule)) {
    console.warn(`[crawler] invalid CRAWLER_CRON "${schedule}", not scheduling.`);
    return;
  }
  console.log(`[crawler] ENABLED, schedule "${schedule}". Proxy ${process.env.SCRAPER_PROXY_URL ? 'configured' : 'NOT configured (expect blocks)'}.`);
  cron.schedule(schedule, () => {
    console.log('[crawler] scheduled run starting');
    runFullCrawl().then((r) => console.log('[crawler] run done', r.length, 'tasks'));
  });
}

/**
 * Manual one-shot scrape for testing selectors / proxy setup.
 *
 *   npm --workspace server run scrape:test -- ddproperty khaoyai
 */
import '../env.js';
import type { RegionId } from '../types.js';
import { getScraper } from './registry.js';

const [sourceArg, regionArg] = process.argv.slice(2);
const source = sourceArg || 'ddproperty';
const region = (regionArg || 'khaoyai') as RegionId;

const scraper = getScraper(source);
if (!scraper) {
  console.error(`Unknown source "${source}". Try: ddproperty | kaidee | baania`);
  process.exit(1);
}

console.log(`Scraping ${scraper.label} / ${region} ...`);
console.log(`Search URL: ${scraper.searchUrl(region)}`);

const res = await scraper.scrape({
  regionId: region,
  max: Number(process.env.SCRAPER_MAX_PER_RUN || 25),
  delayMs: Number(process.env.SCRAPER_DELAY_MS || 6000),
});

console.log(JSON.stringify({ ok: res.ok, blocked: res.blocked, error: res.error, count: res.listings.length }, null, 2));
console.log(res.listings.slice(0, 3));

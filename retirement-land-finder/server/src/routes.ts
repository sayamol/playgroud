import { Router } from 'express';
import regionsData from './data/regions.json';
import { allListings, getMeta, resetToSeed } from './store.js';
import { getEnriched, invalidateEnrichCache } from './enrich.js';
import { crawlerStatus, runFullCrawl } from './crawler.js';
import { getScraper } from './scrapers/registry.js';
import { upsertListings } from './store.js';
import { getTreasuryAppraisal } from './appraisal/treasury.js';
import type { RegionId } from './types.js';

export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

api.get('/regions', (_req, res) => {
  res.json({
    bangkok: regionsData.bangkok,
    regions: regionsData.regions,
    pois: regionsData.pois,
  });
});

api.get('/listings', async (req, res) => {
  const force = req.query.refresh === '1' || req.query.refresh === 'true';
  try {
    const listings = await getEnriched(allListings(), { force });
    res.json({ listings, meta: getMeta(), crawler: crawlerStatus() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

api.get('/listings/:id', async (req, res) => {
  const listings = await getEnriched(allListings());
  const found = listings.find((l) => l.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'not found' });
  res.json(found);
});

api.get('/meta', (_req, res) => {
  res.json({ meta: getMeta(), crawler: crawlerStatus() });
});

// Live government appraisal for an arbitrary point (bypasses the enrich cache).
api.post('/appraisal', async (req, res) => {
  const { lat, lng, landAreaSqm, provinceHint } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng (numbers) are required' });
  }
  try {
    const info = await getTreasuryAppraisal({
      lat,
      lng,
      landAreaSqm: Number(landAreaSqm) || 1600,
      provinceHint,
    });
    res.json({ appraisal: info });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Trigger a scrape now. body: { source?, regionId? }. Omit both = full crawl.
api.post('/scrape', async (req, res) => {
  const { source, regionId } = req.body || {};
  try {
    if (!source && !regionId) {
      const results = await runFullCrawl();
      invalidateEnrichCache();
      return res.json({ mode: 'full', results });
    }
    const scraper = getScraper(String(source));
    if (!scraper) return res.status(400).json({ error: `unknown source "${source}"` });
    const region = (regionId || 'khaoyai') as RegionId;
    const result = await scraper.scrape({
      regionId: region,
      max: Number(process.env.SCRAPER_MAX_PER_RUN || 25),
      delayMs: Number(process.env.SCRAPER_DELAY_MS || 6000),
    });
    let upserted = { added: 0, updated: 0 };
    if (result.ok && result.listings.length) {
      upserted = upsertListings(scraper.id, result.listings);
      invalidateEnrichCache();
    }
    res.json({ mode: 'single', result: { ...result, ...upserted } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

api.post('/admin/reset-seed', (_req, res) => {
  resetToSeed();
  invalidateEnrichCache();
  res.json({ ok: true, meta: getMeta() });
});

import './env.js';
import express from 'express';
import cors from 'cors';
import { api } from './routes.js';
import { loadDb, allListings } from './store.js';
import { getEnriched } from './enrich.js';
import { startCrawler } from './crawler.js';

const PORT = Number(process.env.PORT || 5175);

loadDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);

app.get('/', (_req, res) => {
  res.type('text').send('Retirement Land Finder API. See /api/health, /api/listings, /api/regions');
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] ${allListings().length} listings in store`);
  startCrawler();
  // Warm the enrich cache (distances + live appraisal) in the background.
  getEnriched(allListings())
    .then((l) => console.log(`[api] enrich cache warm: ${l.length} listings`))
    .catch((e) => console.warn('[api] enrich warm failed:', e.message));
});

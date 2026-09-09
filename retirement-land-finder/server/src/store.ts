import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { RawListing, SourceId } from './types.js';
import { generateSeed, SEED_VERSION } from './seed/generate.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

interface Db {
  seedVersion: number;
  listings: Record<string, RawListing>;
  meta: {
    createdAt: string;
    lastScrapeAt: string | null;
    lastScrapeSummary: Record<string, { added: number; updated: number; at: string }>;
  };
}

let db: Db;

function fresh(): Db {
  const seed = generateSeed();
  const listings: Record<string, RawListing> = {};
  for (const l of seed) listings[l.id] = l;
  return {
    seedVersion: SEED_VERSION,
    listings,
    meta: { createdAt: new Date().toISOString(), lastScrapeAt: null, lastScrapeSummary: {} },
  };
}

export function loadDb(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (existsSync(DB_PATH)) {
    try {
      db = JSON.parse(readFileSync(DB_PATH, 'utf8')) as Db;
      if (
        !db.listings ||
        Object.keys(db.listings).length === 0 ||
        db.seedVersion !== SEED_VERSION
      ) {
        db = fresh();
      }
    } catch {
      db = fresh();
    }
  } else {
    db = fresh();
  }
  save();
}

function save(): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function allListings(): RawListing[] {
  return Object.values(db.listings);
}

export function getListing(id: string): RawListing | undefined {
  return db.listings[id];
}

export function getMeta() {
  return { ...db.meta, count: Object.keys(db.listings).length };
}

/** Upsert scraped listings. Key = source + sourceListingId. */
export function upsertListings(source: SourceId, incoming: RawListing[]) {
  let added = 0;
  let updated = 0;
  for (const l of incoming) {
    const key = `${source}:${l.sourceListingId}`;
    const existing = Object.values(db.listings).find(
      (x) => `${x.source}:${x.sourceListingId}` === key,
    );
    if (existing) {
      db.listings[existing.id] = { ...existing, ...l, id: existing.id };
      updated++;
    } else {
      const id = `${source}-${l.sourceListingId}`.replace(/[^\w-]/g, '_');
      db.listings[id] = { ...l, id };
      added++;
    }
  }
  const at = new Date().toISOString();
  db.meta.lastScrapeAt = at;
  db.meta.lastScrapeSummary[source] = { added, updated, at };
  save();
  return { added, updated };
}

export function resetToSeed() {
  db = fresh();
  save();
}

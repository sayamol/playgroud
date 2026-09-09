import type { SourceId } from '../types.js';
import type { Scraper } from './types.js';
import { ddproperty } from './ddproperty.js';
import { kaidee } from './kaidee.js';
import { baania } from './baania.js';

export const SCRAPERS: Record<Exclude<SourceId, 'sample'>, Scraper> = {
  ddproperty,
  kaidee,
  baania,
};

export const SCRAPER_LIST = Object.values(SCRAPERS);

export function getScraper(id: string): Scraper | undefined {
  return (SCRAPERS as Record<string, Scraper>)[id];
}

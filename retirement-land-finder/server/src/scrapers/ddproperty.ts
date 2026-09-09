import type { RegionId } from '../types.js';
import type { Scraper } from './types.js';
import { runSite, type SiteConfig } from './common.js';

const SEARCH: Record<RegionId, string> = {
  khaoyai: 'https://www.ddproperty.com/en/property-for-sale/land?region_code=TH-30&freetext=Pak%20Chong',
  huahin: 'https://www.ddproperty.com/en/property-for-sale/land?freetext=Hua%20Hin',
  chiangmai: 'https://www.ddproperty.com/en/property-for-sale/land?region_code=TH-50&freetext=Chiang%20Mai',
  bkknat: 'https://www.ddproperty.com/en/property-for-sale/land?freetext=Nakhon%20Nayok',
};

const cfg: SiteConfig = {
  id: 'ddproperty',
  label: 'DDproperty',
  searchUrl: (r) => SEARCH[r],
  async extract(page) {
    // Selectors as of early 2026. DDproperty ships an SSR listing grid.
    // Expect to maintain this; the site A/B-tests markup frequently.
    await page.waitForSelector('.listing-card, [data-test-id="listing-card"]', { timeout: 15000 }).catch(() => {});
    return page.$$eval(
      '.listing-card, [data-test-id="listing-card"]',
      (cards: Element[]) =>
        cards.map((c) => {
          const q = (sel: string) => c.querySelector(sel)?.textContent?.trim() || '';
          const priceText = q('.listing-card-price, [data-test-id="listing-price"]');
          const priceThb = Number(priceText.replace(/[^\d]/g, '')) || 0;
          const areaText = q('.listing-floorarea, [data-test-id="floor-area"]');
          const rai = /([\d.]+)\s*rai/i.exec(areaText)?.[1];
          const sqm = /([\d.,]+)\s*(?:sqm|m²|ตร\.?ม)/i.exec(areaText)?.[1]?.replace(/,/g, '');
          const a = c.querySelector('a[href]') as HTMLAnchorElement | null;
          return {
            title: q('.listing-card-title, [data-test-id="listing-title"]'),
            priceThb,
            landAreaSqm: rai ? Number(rai) * 1600 : sqm ? Number(sqm) : undefined,
            sourceUrl: a?.href || '',
            description: q('.listing-card-description'),
            images: (() => {
              const img = c.querySelector('img');
              const s = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
              return s ? [s] : [];
            })(),
          };
        }),
    );
  },
};

export const ddproperty: Scraper = {
  id: 'ddproperty',
  label: 'DDproperty',
  searchUrl: (r) => SEARCH[r],
  scrape: (opts) => runSite(cfg, opts),
};

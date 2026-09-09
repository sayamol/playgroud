import type { RegionId } from '../types.js';
import type { Scraper } from './types.js';
import { runSite, type SiteConfig } from './common.js';

const SEARCH: Record<RegionId, string> = {
  khaoyai: 'https://www.kaidee.com/c-real-estate-land?q=ปากช่อง%20เขาใหญ่',
  huahin: 'https://www.kaidee.com/c-real-estate-land?q=หัวหิน',
  chiangmai: 'https://www.kaidee.com/c-real-estate-land?q=เชียงใหม่',
  bkknat: 'https://www.kaidee.com/c-real-estate-land?q=นครนายก',
};

const cfg: SiteConfig = {
  id: 'kaidee',
  label: 'Kaidee',
  searchUrl: (r) => SEARCH[r],
  async extract(page) {
    // Kaidee renders a Nuxt product grid.
    await page.waitForSelector('[data-testid="listing-card"], a.product-card', { timeout: 15000 }).catch(() => {});
    return page.$$eval(
      '[data-testid="listing-card"], a.product-card',
      (cards: Element[]) =>
        cards.map((c) => {
          const q = (sel: string) => c.querySelector(sel)?.textContent?.trim() || '';
          const priceThb =
            Number(q('[data-testid="price"], .product-card__price').replace(/[^\d]/g, '')) || 0;
          const titleText = q('[data-testid="title"], .product-card__title');
          const raiMatch = /([\d.]+)\s*(?:ไร่|rai)/i.exec(titleText + ' ' + q('.product-card__detail'));
          const a = (c.closest('a[href]') || c.querySelector('a[href]')) as HTMLAnchorElement | null;
          return {
            title: titleText,
            priceThb,
            landAreaSqm: raiMatch ? Number(raiMatch[1]) * 1600 : undefined,
            sourceUrl: a?.href || '',
            images: (() => {
              const s = c.querySelector('img')?.getAttribute('src') || '';
              return s ? [s] : [];
            })(),
          };
        }),
    );
  },
};

export const kaidee: Scraper = {
  id: 'kaidee',
  label: 'Kaidee',
  searchUrl: (r) => SEARCH[r],
  scrape: (opts) => runSite(cfg, opts),
};

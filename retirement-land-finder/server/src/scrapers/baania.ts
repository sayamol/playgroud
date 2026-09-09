import type { RegionId } from '../types.js';
import type { Scraper } from './types.js';
import { runSite, type SiteConfig } from './common.js';

const SEARCH: Record<RegionId, string> = {
  khaoyai: 'https://www.baania.com/th/search/buy/land?keyword=ปากช่อง',
  huahin: 'https://www.baania.com/th/search/buy/land?keyword=หัวหิน',
  chiangmai: 'https://www.baania.com/th/search/buy/land?keyword=เชียงใหม่',
  bkknat: 'https://www.baania.com/th/search/buy/land?keyword=นครนายก',
};

const cfg: SiteConfig = {
  id: 'baania',
  label: 'Baania',
  searchUrl: (r) => SEARCH[r],
  async extract(page) {
    await page.waitForSelector('.property-card, [class*="PropertyCard"]', { timeout: 15000 }).catch(() => {});
    return page.$$eval(
      '.property-card, [class*="PropertyCard"]',
      (cards: Element[]) =>
        cards.map((c) => {
          const q = (sel: string) => c.querySelector(sel)?.textContent?.trim() || '';
          const priceThb = Number(q('[class*="price"]').replace(/[^\d]/g, '')) || 0;
          const detail = q('[class*="area"]') + ' ' + q('[class*="detail"]');
          const rai = /([\d.]+)\s*(?:ไร่|rai)/i.exec(detail)?.[1];
          const wah = /([\d.]+)\s*(?:ตร\.?ว|ตารางวา|sq\.?\s*wah)/i.exec(detail)?.[1];
          const a = c.querySelector('a[href]') as HTMLAnchorElement | null;
          return {
            title: q('[class*="title"]'),
            priceThb,
            landAreaSqm: rai
              ? Number(rai) * 1600
              : wah
                ? Number(wah) * 4
                : undefined,
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

export const baania: Scraper = {
  id: 'baania',
  label: 'Baania',
  searchUrl: (r) => SEARCH[r],
  scrape: (opts) => runSite(cfg, opts),
};

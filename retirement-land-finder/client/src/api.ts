import type { AppraisalInfo, ListingsPayload, RegionsPayload } from './types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  regions: () => j<RegionsPayload>('/api/regions'),
  listings: (refresh = false) =>
    j<ListingsPayload>(`/api/listings${refresh ? '?refresh=1' : ''}`),
  meta: () => j<{ crawler: ListingsPayload['crawler'] }>('/api/meta'),
  appraisal: (lat: number, lng: number, landAreaSqm: number, provinceHint?: string) =>
    j<{ appraisal: AppraisalInfo | null }>('/api/appraisal', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, landAreaSqm, provinceHint }),
    }),
  scrape: (source?: string, regionId?: string) =>
    j<{ mode: string; result?: unknown; results?: unknown }>('/api/scrape', {
      method: 'POST',
      body: JSON.stringify({ source, regionId }),
    }),
  resetSeed: () => j<{ ok: boolean }>('/api/admin/reset-seed', { method: 'POST' }),
};

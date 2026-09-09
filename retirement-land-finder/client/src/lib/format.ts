import type { Lang, LocalizedName } from '../types';

export function baht(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (opts.compact && Math.abs(n) >= 1_000_000) {
    return `฿${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  }
  if (opts.compact && Math.abs(n) >= 1_000) {
    return `฿${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`;
  }
  return `฿${Math.round(n).toLocaleString()}`;
}

export function km(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n < 10 ? `${n.toFixed(1)} km` : `${Math.round(n)} km`;
}

export function hrs(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function loc(name: LocalizedName | undefined, lang: Lang): string {
  if (!name) return '—';
  return lang === 'th' ? name.th : name.en;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

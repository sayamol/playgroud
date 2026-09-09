/**
 * Encode / decode a shareable comparison into a compact URL token.
 *
 * The token is base64url(JSON) of a short-keyed shape so a comparison
 * (selected parcels + scoring weights + budget) can be bookmarked or
 * sent to someone. Decoding is deliberately forgiving: anything that
 * does not look right is dropped rather than throwing, so a stale or
 * hand-mangled link still loads the app.
 */
import type { FactorKey, Weights } from '../types';
import { FACTOR_KEYS } from './scoring';

export interface ShareState {
  compareIds: string[];
  weights: Partial<Weights>;
  budgetThb?: number;
  useAllInCost: boolean;
}

const MAX_IDS = 12;

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string | null {
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  } catch {
    return null;
  }
}

export function encodeShareState(state: {
  compareIds: string[];
  weights: Weights;
  budgetThb?: number;
  useAllInCost?: boolean;
}): string {
  const payload = {
    c: state.compareIds.slice(0, MAX_IDS),
    w: state.weights,
    b: state.budgetThb,
    a: state.useAllInCost ? 1 : 0,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShareState(token: string): ShareState | null {
  if (!token) return null;
  const json = fromBase64Url(token);
  if (json == null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const compareIds = Array.isArray(o.c)
    ? o.c.filter((x): x is string => typeof x === 'string').slice(0, MAX_IDS)
    : [];

  const weights: Partial<Weights> = {};
  if (o.w && typeof o.w === 'object') {
    for (const k of FACTOR_KEYS) {
      const v = (o.w as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v)) weights[k as FactorKey] = v;
    }
  }

  const budgetThb =
    typeof o.b === 'number' && Number.isFinite(o.b) && o.b > 0 ? o.b : undefined;

  return { compareIds, weights, budgetThb, useAllInCost: o.a === 1 || o.a === true };
}

export function shareUrl(
  origin: string,
  pathname: string,
  state: Parameters<typeof encodeShareState>[0],
): string {
  return `${origin}${pathname}?c=${encodeShareState(state)}`;
}

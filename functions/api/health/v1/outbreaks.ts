/**
 * Outbreaks endpoint — Cloudflare Pages Function.
 * Queries D1 directly for hotspot data across last 7 days.
 * Replaces Vercel edge function that proxied to CF Worker via HTTP.
 */
import { jsonResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';
import { fetchOutbreaksFromD1 } from '../../../_shared/outbreak-query';

const CACHE_KEY = 'outbreaks';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cached = getCached<{ outbreaks: unknown[]; fetchedAt: number; sources: string[] }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 600);

  try {
    const outbreaks = await fetchOutbreaksFromD1(context.env.DB);
    const payload = {
      outbreaks,
      fetchedAt: Date.now(),
      sources: outbreaks.length > 0 ? ['pipeline'] : [],
    };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 600);
  } catch (err) {
    // D1 unreachable — return empty payload so UI degrades gracefully
    const payload = {
      outbreaks: [],
      fetchedAt: Date.now(),
      sources: [],
      error: err instanceof Error ? err.message : 'D1 query failed',
    };
    return jsonResponse(payload, 200, 60);
  }
};

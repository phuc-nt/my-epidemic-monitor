/**
 * Epidemic statistics endpoint — Cloudflare Pages Function.
 * Aggregates stats from D1 outbreaks via shared query (no internal HTTP self-call).
 */
import { jsonResponse, errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';
import { fetchOutbreaksFromD1 } from '../../../_shared/outbreak-query';

const CACHE_KEY = 'stats';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cached = getCached<{ stats: unknown; fetchedAt: number }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 3600);

  try {
    const outbreaks = await fetchOutbreaksFromD1(context.env.DB);

    const diseaseCount = new Map<string, number>();
    const countriesAffected = new Set<string>();
    let activeAlerts = 0;

    for (const item of outbreaks) {
      diseaseCount.set(item.disease, (diseaseCount.get(item.disease) ?? 0) + 1);
      if (item.countryCode) countriesAffected.add(item.countryCode);
      if (item.alertLevel === 'alert') activeAlerts++;
    }

    const topDiseases = Array.from(diseaseCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([disease, count]) => ({ disease, count }));

    const stats = {
      totalOutbreaks: outbreaks.length,
      activeAlerts,
      countriesAffected: countriesAffected.size,
      topDiseases,
      lastUpdated: Date.now(),
    };

    const payload = { stats, fetchedAt: Date.now() };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 3600);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to compute stats');
  }
};

/**
 * Country health profiles endpoint — Cloudflare Pages Function.
 * Aggregates profiles from D1 outbreaks via shared query (no internal HTTP self-call).
 * Supports optional ?code=XX query param for single-country lookup.
 */
import { jsonResponse, errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';
import { fetchOutbreaksFromD1 } from '../../../_shared/outbreak-query';

const CACHE_KEY = 'countries';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const ALERT_RANK: Record<string, number> = { alert: 3, warning: 2, watch: 1 };

function deriveRiskLevel(levels: string[]): 'alert' | 'warning' | 'watch' {
  const max = levels.reduce((best, l) => Math.max(best, ALERT_RANK[l] ?? 1), 1);
  if (max >= 3) return 'alert';
  if (max >= 2) return 'warning';
  return 'watch';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const filterCode = url.searchParams.get('code')?.toUpperCase() ?? '';

  const cached = getCached<{ profiles: unknown[]; fetchedAt: number }>(CACHE_KEY);
  if (cached) {
    if (filterCode) {
      const single = (cached.profiles as Array<{ countryCode: string }>).filter(
        p => p.countryCode === filterCode,
      );
      return jsonResponse({ profiles: single, fetchedAt: cached.fetchedAt }, 200, 1800);
    }
    return jsonResponse(cached, 200, 1800);
  }

  try {
    const outbreaks = await fetchOutbreaksFromD1(context.env.DB);

    const byCountry = new Map<
      string,
      { country: string; diseases: Set<string>; levels: string[]; lastUpdated: number }
    >();

    for (const item of outbreaks) {
      if (!item.countryCode) continue;
      const entry = byCountry.get(item.countryCode) ?? {
        country: item.country,
        diseases: new Set<string>(),
        levels: [],
        lastUpdated: 0,
      };
      entry.diseases.add(item.disease);
      entry.levels.push(item.alertLevel);
      if (item.publishedAt > entry.lastUpdated) entry.lastUpdated = item.publishedAt;
      byCountry.set(item.countryCode, entry);
    }

    const profiles = Array.from(byCountry.entries()).map(([code, data]) => ({
      countryCode: code,
      countryName: data.country,
      activeOutbreaks: data.diseases.size,
      riskLevel: deriveRiskLevel(data.levels),
      diseases: Array.from(data.diseases),
      lastUpdated: data.lastUpdated,
    }));

    const payload = { profiles, fetchedAt: Date.now() };
    setCached(CACHE_KEY, payload, CACHE_TTL);

    if (filterCode) {
      const single = profiles.filter(p => p.countryCode === filterCode);
      return jsonResponse({ profiles: single, fetchedAt: Date.now() }, 200, 1800);
    }
    return jsonResponse(payload, 200, 1800);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch country profiles');
  }
};

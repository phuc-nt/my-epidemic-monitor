/**
 * Country health profiles API route.
 * Aggregates CountryHealthProfile records from the outbreaks feed.
 * Supports optional ?code=XX query param for single-country lookup.
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'countries';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const OUTBREAKS_URL = '/api/health/v1/outbreaks';

interface OutbreakItem {
  disease: string;
  country: string;
  countryCode: string;
  alertLevel: 'alert' | 'warning' | 'watch';
  publishedAt: number;
}

interface OutbreaksPayload {
  outbreaks: OutbreakItem[];
}

const ALERT_RANK: Record<string, number> = { alert: 3, warning: 2, watch: 1 };

function deriveRiskLevel(levels: string[]): 'alert' | 'warning' | 'watch' {
  const max = levels.reduce((best, l) => Math.max(best, ALERT_RANK[l] ?? 1), 1);
  if (max >= 3) return 'alert';
  if (max >= 2) return 'warning';
  return 'watch';
}

export default async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const filterCode = url.searchParams.get('code')?.toUpperCase() ?? '';

  const cached = getCached<{ profiles: unknown[]; fetchedAt: number }>(CACHE_KEY);
  if (cached) {
    if (filterCode) {
      const single = (cached.profiles as Array<{ countryCode: string }>).filter(
        (p) => p.countryCode === filterCode,
      );
      return jsonResponse({ profiles: single, fetchedAt: cached.fetchedAt }, 200, 1800);
    }
    return jsonResponse(cached, 200, 1800);
  }

  try {
    const outbreaksUrl = `${url.origin}${OUTBREAKS_URL}`;
    const res = await fetch(outbreaksUrl);
    if (!res.ok) throw new Error(`Outbreaks fetch ${res.status}`);

    const { outbreaks }: OutbreaksPayload = await res.json();

    // Group by countryCode
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
      const single = profiles.filter((p) => p.countryCode === filterCode);
      return jsonResponse({ profiles: single, fetchedAt: Date.now() }, 200, 1800);
    }

    return jsonResponse(payload, 200, 1800);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch country profiles');
  }
}

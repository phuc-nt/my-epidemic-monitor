/**
 * Epidemic statistics API route.
 * Aggregates stats from the outbreaks feed (count per disease, per country, alert levels).
 * Avoids additional external API calls — derived entirely from /outbreaks data.
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'stats';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const OUTBREAKS_URL = '/api/health/v1/outbreaks';

interface OutbreakItem {
  id: string;
  disease: string;
  country: string;
  countryCode: string;
  alertLevel: 'alert' | 'warning' | 'watch';
}

interface OutbreaksPayload {
  outbreaks: OutbreakItem[];
}

export default async function GET(request: Request): Promise<Response> {
  const cached = getCached<{ stats: unknown; fetchedAt: number }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 3600);

  try {
    // Derive base URL from incoming request to call sibling route
    const url = new URL(request.url);
    const outbreaksUrl = `${url.origin}${OUTBREAKS_URL}`;

    const res = await fetch(outbreaksUrl);
    if (!res.ok) throw new Error(`Outbreaks fetch ${res.status}`);

    const { outbreaks }: OutbreaksPayload = await res.json();

    // Disease frequency map
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
}

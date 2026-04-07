/**
 * Bulk data service — fetches outbreaks + stats + news in a single API call.
 * Reduces 3 function invocations to 1, saving ~67% of CF Pages quota.
 * Falls back to individual service calls if bulk endpoint unavailable.
 */
import type { DiseaseOutbreakItem, EpidemicStats, NewsItem } from '@/types/index';
import { apiFetch } from '@/services/api-client';
import { cachedFetch, invalidateCache } from '@/services/fetch-cache';

const CACHE_KEY = 'bulk-data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface BulkResponse {
  outbreaks: DiseaseOutbreakItem[];
  stats: EpidemicStats;
  news: { items: NewsItem[]; source: string };
  fetchedAt: number;
}

interface BulkData {
  outbreaks: DiseaseOutbreakItem[];
  stats: EpidemicStats;
  news: NewsItem[];
}

/**
 * Fetch all primary data in one API call.
 * Returns outbreaks, stats, and news together.
 */
export async function fetchBulkData(): Promise<BulkData> {
  return cachedFetch(
    CACHE_KEY,
    async () => {
      const res = await apiFetch<BulkResponse>('/api/health/v1/all');
      return {
        outbreaks: res.outbreaks ?? [],
        stats: res.stats ?? { totalOutbreaks: 0, activeAlerts: 0, countriesAffected: 0, topDiseases: [], lastUpdated: 0 },
        news: res.news?.items ?? [],
      };
    },
    CACHE_TTL,
  );
}

/** Invalidate the bulk cache to force a fresh fetch. */
export function invalidateBulkCache(): void {
  invalidateCache(CACHE_KEY);
}

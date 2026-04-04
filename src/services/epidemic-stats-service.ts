/**
 * Client service for fetching aggregated epidemic statistics.
 * Caches results for 1 hour.
 */
import type { EpidemicStats } from '@/types/index';
import { apiFetch } from '@/services/api-client';
import { cachedFetch } from '@/services/fetch-cache';

const CACHE_KEY = 'epidemic-stats';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface StatsResponse {
  stats: EpidemicStats;
  fetchedAt: number;
}

/**
 * Fetch aggregated epidemic statistics.
 * Returns a zeroed stats object on error for graceful degradation.
 */
export async function fetchEpidemicStats(): Promise<EpidemicStats> {
  try {
    return await cachedFetch(
      CACHE_KEY,
      async () => {
        const res = await apiFetch<StatsResponse>('/api/health/v1/stats');
        return res.stats;
      },
      CACHE_TTL,
    );
  } catch {
    return {
      totalOutbreaks: 0,
      activeAlerts: 0,
      countriesAffected: 0,
      topDiseases: [],
      lastUpdated: 0,
    };
  }
}

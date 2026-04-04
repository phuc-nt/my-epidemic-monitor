/**
 * Client service for fetching aggregated health news from multiple RSS sources.
 * Caches results for 15 minutes.
 */
import type { NewsItem } from '@/types/index';
import { apiFetch } from '@/services/api-client';
import { cachedFetch } from '@/services/fetch-cache';

const CACHE_KEY = 'health-news';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface NewsResponse {
  items: NewsItem[];
  fetchedAt: number;
  sources: string[];
}

/**
 * Fetch aggregated health news from WHO, CDC, ProMED, ECDC, ReliefWeb.
 * Returns empty array on error for graceful degradation in dev mode.
 */
export async function fetchHealthNews(): Promise<NewsItem[]> {
  try {
    return await cachedFetch(
      CACHE_KEY,
      async () => {
        const res = await apiFetch<NewsResponse>('/api/health/v1/news');
        return res.items;
      },
      CACHE_TTL,
    );
  } catch {
    return [];
  }
}

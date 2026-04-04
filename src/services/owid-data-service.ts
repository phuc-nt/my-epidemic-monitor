/**
 * Client service for fetching OWID COVID-19 latest data.
 * Caches results for 6 hours (data updates daily).
 */
import type { OwidCountryRecord } from '@/types/index';
import { apiFetch } from '@/services/api-client';
import { cachedFetch } from '@/services/fetch-cache';

const CACHE_KEY = 'owid-data';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface OwidResponse {
  countries: OwidCountryRecord[];
  fetchedAt: number;
}

/**
 * Fetch OWID COVID-19 country data (top 50 by total cases).
 * Returns empty array on error for graceful degradation.
 */
export async function fetchOwidData(): Promise<OwidCountryRecord[]> {
  try {
    return await cachedFetch(
      CACHE_KEY,
      async () => {
        const res = await apiFetch<OwidResponse>('/api/health/v1/owid');
        return res.countries;
      },
      CACHE_TTL,
    );
  } catch {
    return [];
  }
}

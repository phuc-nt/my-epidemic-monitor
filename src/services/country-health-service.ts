/**
 * Client service for fetching country health profiles.
 * Caches results for 30 minutes.
 */
import type { CountryHealthProfile } from '@/types/index';
import { apiFetch } from '@/services/api-client';
import { cachedFetch } from '@/services/fetch-cache';

const CACHE_KEY = 'country-profiles';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CountriesResponse {
  profiles: CountryHealthProfile[];
  fetchedAt: number;
}

/**
 * Fetch all country health profiles aggregated from outbreak data.
 * Returns empty array on error for graceful degradation.
 */
export async function fetchCountryProfiles(): Promise<CountryHealthProfile[]> {
  try {
    return await cachedFetch(
      CACHE_KEY,
      async () => {
        const res = await apiFetch<CountriesResponse>('/api/health/v1/countries');
        return res.profiles;
      },
      CACHE_TTL,
    );
  } catch {
    return [];
  }
}

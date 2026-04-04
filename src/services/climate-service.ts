/**
 * Client service for the Climate Predictive Alerts feature.
 * Fetches 14-day dengue/HFMD risk forecasts for Vietnam provinces.
 * Falls back to hardcoded sample data when the API is unavailable.
 */
import { apiFetch } from '@/services/api-client';
import { cachedFetch } from '@/services/fetch-cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface ClimateForecast {
  province:    string;
  lat:         number;
  lng:         number;
  dengueRisk:  number;
  hfmdRisk:    number;
  dengueLevel: RiskLevel;
  hfmdLevel:   RiskLevel;
  tempMax:     number;
  tempMin:     number;
  rainfall:    number;
  humidity:    number;
  forecastDays: number;
  peakRiskDay:  string;
}

// No sample data — all climate forecasts come from real Open-Meteo weather API

// ---------------------------------------------------------------------------
// Service function
// ---------------------------------------------------------------------------

const CACHE_KEY = 'climate-forecasts';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface ClimateApiResponse {
  forecasts: ClimateForecast[];
  fetchedAt: number;
}

/**
 * Fetch 14-day climate-based dengue/HFMD risk forecasts for Vietnam provinces.
 * Returns hardcoded sample data if the API call fails.
 */
export async function fetchClimateForecasts(): Promise<ClimateForecast[]> {
  try {
    return await cachedFetch(
      CACHE_KEY,
      async () => {
        const res = await apiFetch<ClimateApiResponse>('/api/health/v1/climate');
        return res.forecasts;
      },
      CACHE_TTL,
    );
  } catch {
    // API unavailable — return empty (no fake data)
    return [];
  }
}

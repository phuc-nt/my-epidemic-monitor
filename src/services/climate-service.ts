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

// ---------------------------------------------------------------------------
// Fallback sample data (hardcoded for offline / dev mode)
// ---------------------------------------------------------------------------

const SAMPLE_CLIMATE: ClimateForecast[] = [
  { province: 'TP. Hồ Chí Minh', lat: 10.82, lng: 106.63, dengueRisk: 0.82, hfmdRisk: 0.55, dengueLevel: 'HIGH',     hfmdLevel: 'MODERATE', tempMax: 34, tempMin: 26, rainfall: 15.2, humidity: 78, forecastDays: 14, peakRiskDay: '2026-04-08' },
  { province: 'Hà Nội',           lat: 21.03, lng: 105.85, dengueRisk: 0.45, hfmdRisk: 0.35, dengueLevel: 'MODERATE', hfmdLevel: 'MODERATE', tempMax: 30, tempMin: 22, rainfall:  8.0, humidity: 72, forecastDays: 14, peakRiskDay: '2026-04-10' },
  { province: 'Đà Nẵng',          lat: 16.05, lng: 108.22, dengueRisk: 0.62, hfmdRisk: 0.48, dengueLevel: 'HIGH',     hfmdLevel: 'MODERATE', tempMax: 32, tempMin: 24, rainfall: 10.5, humidity: 75, forecastDays: 14, peakRiskDay: '2026-04-09' },
  { province: 'Cần Thơ',          lat: 10.04, lng: 105.79, dengueRisk: 0.88, hfmdRisk: 0.60, dengueLevel: 'HIGH',     hfmdLevel: 'HIGH',     tempMax: 35, tempMin: 27, rainfall: 18.0, humidity: 82, forecastDays: 14, peakRiskDay: '2026-04-07' },
  { province: 'Hải Phòng',        lat: 20.86, lng: 106.68, dengueRisk: 0.35, hfmdRisk: 0.30, dengueLevel: 'MODERATE', hfmdLevel: 'LOW',      tempMax: 29, tempMin: 21, rainfall:  5.0, humidity: 70, forecastDays: 14, peakRiskDay: '2026-04-12' },
  { province: 'Khánh Hòa',        lat: 12.25, lng: 109.05, dengueRisk: 0.70, hfmdRisk: 0.42, dengueLevel: 'HIGH',     hfmdLevel: 'MODERATE', tempMax: 33, tempMin: 25, rainfall: 11.0, humidity: 74, forecastDays: 14, peakRiskDay: '2026-04-08' },
  { province: 'Bình Dương',        lat: 11.17, lng: 106.65, dengueRisk: 0.75, hfmdRisk: 0.52, dengueLevel: 'HIGH',     hfmdLevel: 'MODERATE', tempMax: 34, tempMin: 26, rainfall: 14.0, humidity: 77, forecastDays: 14, peakRiskDay: '2026-04-07' },
  { province: 'Đồng Nai',          lat: 10.95, lng: 106.82, dengueRisk: 0.72, hfmdRisk: 0.50, dengueLevel: 'HIGH',     hfmdLevel: 'MODERATE', tempMax: 34, tempMin: 26, rainfall: 13.5, humidity: 76, forecastDays: 14, peakRiskDay: '2026-04-08' },
];

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
    // API unavailable — return static sample data for graceful degradation
    return SAMPLE_CLIMATE;
  }
}

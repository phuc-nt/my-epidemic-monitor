/**
 * Climate Predictive Alerts endpoint — Cloudflare Pages Function.
 * Fetches 14-day weather forecast from Open-Meteo for 8 Vietnam provinces
 * and computes dengue / HFMD risk scores. Cache TTL: 6 hours.
 * No D1 needed — external API only.
 */
import { jsonResponse, errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';

const CACHE_KEY = 'climate-forecasts';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface Province { name: string; lat: number; lng: number; }

const PROVINCES: Province[] = [
  { name: 'Ho Chi Minh City', lat: 10.82, lng: 106.63 },
  { name: 'Ha Noi',           lat: 21.03, lng: 105.85 },
  { name: 'Da Nang',          lat: 16.05, lng: 108.22 },
  { name: 'Can Tho',          lat: 10.04, lng: 105.79 },
  { name: 'Hai Phong',        lat: 20.86, lng: 106.68 },
  { name: 'Khanh Hoa',        lat: 12.25, lng: 109.05 },
  { name: 'Binh Duong',       lat: 11.17, lng: 106.65 },
  { name: 'Dong Nai',         lat: 10.95, lng: 106.82 },
];

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  relative_humidity_2m_mean: number[];
}

interface OpenMeteoResponse { daily: OpenMeteoDaily; }

async function fetchWeather(lat: number, lng: number): Promise<OpenMeteoResponse> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean` +
    `&forecast_days=14&timezone=Asia%2FBangkok`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${lat},${lng}`);
  return res.json() as Promise<OpenMeteoResponse>;
}

type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';
function riskLevel(score: number): RiskLevel {
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.3) return 'MODERATE';
  return 'LOW';
}

function dengueScore(tempMax: number, rainfall: number, humidity: number): number {
  const tempFactor = tempMax >= 25 && tempMax <= 35 ? 1.0
    : tempMax > 35 ? 0.7 : tempMax >= 20 ? 0.3 : 0.1;
  const rainFactor  = rainfall > 20 ? 1.0 : rainfall > 5 ? 0.7 : rainfall > 0 ? 0.3 : 0.05;
  const humidFactor = humidity > 80 ? 1.0 : humidity > 70 ? 0.7 : humidity > 60 ? 0.4 : 0.1;
  return Math.min(1, tempFactor * 0.4 + rainFactor * 0.35 + humidFactor * 0.25);
}

function hfmdScore(tempMax: number, humidity: number): number {
  const tempFactor  = tempMax > 28 ? 1.0 : tempMax > 24 ? 0.5 : 0.2;
  const humidFactor = humidity > 80 ? 1.0 : humidity > 70 ? 0.6 : humidity > 60 ? 0.3 : 0.1;
  return Math.min(1, tempFactor * 0.5 + humidFactor * 0.5);
}

export interface ClimateForecast {
  province: string; lat: number; lng: number;
  dengueRisk: number; hfmdRisk: number;
  dengueLevel: RiskLevel; hfmdLevel: RiskLevel;
  tempMax: number; tempMin: number; rainfall: number; humidity: number;
  forecastDays: number; peakRiskDay: string;
}

function buildForecast(province: Province, data: OpenMeteoDaily): ClimateForecast {
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, relative_humidity_2m_mean } = data;
  const avg = (arr: number[]) => arr.reduce((s, v) => s + (v ?? 0), 0) / arr.length;

  const tempMax  = parseFloat(avg(temperature_2m_max).toFixed(1));
  const tempMin  = parseFloat(avg(temperature_2m_min).toFixed(1));
  const rainfall = parseFloat(avg(precipitation_sum).toFixed(1));
  const humidity = parseFloat(avg(relative_humidity_2m_mean).toFixed(1));

  let peakScore = -1;
  let peakRiskDay = time[0] ?? '';
  for (let i = 0; i < time.length; i++) {
    const dayScore = dengueScore(
      temperature_2m_max[i] ?? 0,
      precipitation_sum[i] ?? 0,
      relative_humidity_2m_mean[i] ?? 0,
    );
    if (dayScore > peakScore) { peakScore = dayScore; peakRiskDay = time[i] ?? ''; }
  }

  return {
    province: province.name, lat: province.lat, lng: province.lng,
    dengueRisk: parseFloat(dengueScore(tempMax, rainfall, humidity).toFixed(2)),
    hfmdRisk:   parseFloat(hfmdScore(tempMax, humidity).toFixed(2)),
    dengueLevel: riskLevel(parseFloat(dengueScore(tempMax, rainfall, humidity).toFixed(2))),
    hfmdLevel:   riskLevel(parseFloat(hfmdScore(tempMax, humidity).toFixed(2))),
    tempMax, tempMin, rainfall, humidity,
    forecastDays: time.length, peakRiskDay,
  };
}

export const onRequestGet: PagesFunction<Env> = async (_context) => {
  const cached = getCached<{ forecasts: ClimateForecast[]; fetchedAt: number }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 21600);

  const results = await Promise.allSettled(PROVINCES.map(p => fetchWeather(p.lat, p.lng)));

  const forecasts: ClimateForecast[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result?.status === 'fulfilled') {
      try { forecasts.push(buildForecast(PROVINCES[i]!, result.value.daily)); } catch { /* skip */ }
    }
  }

  if (forecasts.length === 0) return errorResponse('All province weather fetches failed', 502);

  const payload = { forecasts, fetchedAt: Date.now() };
  setCached(CACHE_KEY, payload, CACHE_TTL);
  return jsonResponse(payload, 200, 21600);
};

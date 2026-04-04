/**
 * Our World In Data (OWID) COVID-19 latest data proxy.
 * Fetches the OWID CSV, parses it, and returns top 50 countries by total_cases.
 * Excludes aggregated rows (OWID_ prefix iso codes).
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'owid';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const OWID_CSV_URL =
  'https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.csv';

const WANTED_COLS = [
  'location',
  'iso_code',
  'total_cases',
  'total_deaths',
  'total_cases_per_million',
  'total_deaths_per_million',
  'total_vaccinations_per_hundred',
  'last_updated_date',
] as const;

type WantedCol = (typeof WANTED_COLS)[number];

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ countries: unknown[]; fetchedAt: number }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 21600);

  try {
    const res = await fetch(OWID_CSV_URL, {
      headers: { 'User-Agent': 'EpidemicMonitor/1.0' },
    });
    if (!res.ok) throw new Error(`OWID CSV ${res.status}`);

    const text = await res.text();
    const rows = parseCsv(text);

    const countries = rows
      // Exclude OWID aggregate rows (iso_code starts with OWID_)
      .filter((r) => r['iso_code'] && !r['iso_code'].startsWith('OWID_'))
      .map((r) => {
        const record: Record<WantedCol, string | number> = {} as Record<WantedCol, string | number>;
        for (const col of WANTED_COLS) {
          if (col === 'location' || col === 'iso_code' || col === 'last_updated_date') {
            record[col] = r[col] ?? '';
          } else {
            record[col] = parseNum(r[col] ?? '');
          }
        }
        return record;
      })
      .sort((a, b) => {
        // Vietnam always first
        if (a['iso_code'] === 'VNM') return -1;
        if (b['iso_code'] === 'VNM') return 1;
        // Then Southeast Asia neighbors
        const seaCodes = new Set(['THA', 'KHM', 'LAO', 'MMR', 'MYS', 'SGP', 'IDN', 'PHL']);
        const aIsSea = seaCodes.has(a['iso_code'] as string);
        const bIsSea = seaCodes.has(b['iso_code'] as string);
        if (aIsSea && !bIsSea) return -1;
        if (!aIsSea && bIsSea) return 1;
        return (b['total_cases'] as number) - (a['total_cases'] as number);
      })
      .slice(0, 50);

    const payload = { countries, fetchedAt: Date.now() };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 21600);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch OWID data');
  }
}

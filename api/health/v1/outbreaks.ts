/**
 * Disease outbreak proxy — Mac Mini pipeline as primary and sole source.
 * Fetches hotspot data from Mac Mini FastAPI via Cloudflare tunnel.
 * Adds lat/lng from VN_PROVINCES lookup so map markers render correctly.
 * Returns empty array gracefully if Mac Mini is offline.
 */
import { jsonResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';
import { diseaseLabel } from '../../_disease-labels';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'outbreaks';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Vietnam province centroids — used to add lat/lng to pipeline hotspot items. */
const VN_PROVINCES: Record<string, [number, number]> = {
  // English names
  'Hanoi': [21.03, 105.85], 'Ha Noi': [21.03, 105.85],
  'Ho Chi Minh': [10.82, 106.63], 'HCMC': [10.82, 106.63], 'Saigon': [10.82, 106.63],
  'Da Nang': [16.05, 108.22], 'Hai Phong': [20.86, 106.68],
  'Can Tho': [10.04, 105.79], 'Binh Duong': [11.17, 106.65],
  'Dong Nai': [10.95, 106.82], 'Khanh Hoa': [12.25, 109.05],
  'Quang Ninh': [21.01, 107.29], 'Thanh Hoa': [19.81, 105.78],
  'Nghe An': [18.97, 105.17], 'Ha Tinh': [18.34, 105.91],
  'Binh Thuan': [11.09, 108.07], 'Lam Dong': [11.94, 108.44],
  'Dak Lak': [12.71, 108.24], 'Gia Lai': [13.98, 108.00],
  'Quang Nam': [15.57, 108.47], 'Binh Dinh': [13.78, 109.22],
  'Phu Yen': [13.09, 109.09], 'Thua Thien Hue': [16.47, 107.60],
  'Hue': [16.47, 107.60], 'Quang Binh': [17.47, 106.60],
  'Quang Tri': [16.75, 107.19], 'Ninh Binh': [20.25, 105.97],
  'Thai Binh': [20.45, 106.34], 'Nam Dinh': [20.43, 106.16],
  'Vinh Phuc': [21.31, 105.60], 'Bac Ninh': [21.19, 106.07],
  'Hung Yen': [20.65, 106.06], 'Hai Duong': [20.94, 106.31],
  'Thai Nguyen': [21.59, 105.85], 'Bac Giang': [21.27, 106.19],
  'Lang Son': [21.85, 106.76], 'Cao Bang': [22.67, 106.26],
  'Son La': [21.33, 103.91], 'Lai Chau': [22.39, 103.46],
  'Lao Cai': [22.49, 103.97], 'Yen Bai': [21.72, 104.87],
  'Tuyen Quang': [21.78, 105.21], 'Ha Giang': [22.83, 104.98],
  'Phu Tho': [21.42, 105.23], 'Hoa Binh': [20.81, 105.34],
  'Long An': [10.54, 106.41], 'Tien Giang': [10.35, 106.36],
  'Ben Tre': [10.24, 106.38], 'Tra Vinh': [9.95, 106.34],
  'Vinh Long': [10.25, 105.97], 'Dong Thap': [10.45, 105.63],
  'An Giang': [10.52, 105.13], 'Kien Giang': [10.01, 105.08],
  'Bac Lieu': [9.29, 105.72], 'Ca Mau': [9.18, 105.15],
  'Soc Trang': [9.60, 105.98], 'Hau Giang': [9.78, 105.47],
  'Tay Ninh': [11.31, 106.10], 'Binh Phuoc': [11.75, 106.72],
  'Ba Ria Vung Tau': [10.50, 107.17], 'Vung Tau': [10.35, 107.08],
  'Kon Tum': [14.35, 108.00], 'Ninh Thuan': [11.58, 108.99],
  'Dak Nong': [12.00, 107.69], 'Quang Ngai': [15.12, 108.80],
  // Vietnamese names — pipeline returns these directly from DB
  'Hà Nội': [21.03, 105.85],
  'TP.HCM': [10.82, 106.63], 'Hồ Chí Minh': [10.82, 106.63],
  'Đà Nẵng': [16.05, 108.22],
  'Hải Phòng': [20.86, 106.68],
  'Cần Thơ': [10.04, 105.79],
  'Bình Dương': [11.17, 106.65],
  'Đồng Nai': [10.95, 106.82],
  'Khánh Hòa': [12.25, 109.05],
  'Quảng Ninh': [21.01, 107.29],
  'Thanh Hóa': [19.81, 105.78],
  'Nghệ An': [18.97, 105.17],
  'Hà Tĩnh': [18.34, 105.91],
  'Bình Thuận': [11.09, 108.07],
  'Lâm Đồng': [11.94, 108.44],
  'Đắk Lắk': [12.71, 108.24],
  'Gia Lai': [13.98, 108.00],
  'Quảng Nam': [15.57, 108.47],
  'Bình Định': [13.78, 109.22],
  'Phú Yên': [13.09, 109.09],
  'Thừa Thiên Huế': [16.47, 107.60], 'Huế': [16.47, 107.60],
  'Quảng Bình': [17.47, 106.60],
  'Quảng Trị': [16.75, 107.19],
  'Ninh Bình': [20.25, 105.97],
  'Thái Bình': [20.45, 106.34],
  'Nam Định': [20.43, 106.16],
  'Vĩnh Phúc': [21.31, 105.60],
  'Bắc Ninh': [21.19, 106.07],
  'Hưng Yên': [20.65, 106.06],
  'Hải Dương': [20.94, 106.31],
  'Thái Nguyên': [21.59, 105.85],
  'Bắc Giang': [21.27, 106.19],
  'Lạng Sơn': [21.85, 106.76],
  'Cao Bằng': [22.67, 106.26],
  'Sơn La': [21.33, 103.91],
  'Lai Châu': [22.39, 103.46],
  'Lào Cai': [22.49, 103.97],
  'Yên Bái': [21.72, 104.87],
  'Tuyên Quang': [21.78, 105.21],
  'Hà Giang': [22.83, 104.98],
  'Phú Thọ': [21.42, 105.23],
  'Hòa Bình': [20.81, 105.34],
  'Long An': [10.54, 106.41],
  'Tiền Giang': [10.35, 106.36],
  'Bến Tre': [10.24, 106.38],
  'Trà Vinh': [9.95, 106.34],
  'Vĩnh Long': [10.25, 105.97],
  'Đồng Tháp': [10.45, 105.63],
  'An Giang': [10.52, 105.13],
  'Kiên Giang': [10.01, 105.08],
  'Bạc Liêu': [9.29, 105.72],
  'Cà Mau': [9.18, 105.15],
  'Sóc Trăng': [9.60, 105.98],
  'Hậu Giang': [9.78, 105.47],
  'Tây Ninh': [11.31, 106.10],
  'Bình Phước': [11.75, 106.72],
  'Bà Rịa - Vũng Tàu': [10.50, 107.17], 'Vũng Tàu': [10.35, 107.08],
  'Kon Tum': [14.35, 108.00],
  'Ninh Thuận': [11.58, 108.99],
  'Đắk Nông': [12.00, 107.69],
  'Quảng Ngãi': [15.12, 108.80],
  // Regional/aggregate terms from pipeline — map to geographic centroid of region
  'Toàn quốc': [16.05, 108.22],
  'phía Nam': [10.50, 106.50],
  'ĐBSCL': [10.00, 105.50],
};

function resolveProvinceCoords(province: string): [number, number] | null {
  // Exact match first
  if (VN_PROVINCES[province]) return VN_PROVINCES[province];
  // Partial match (e.g. "Đắk Lắk" → "Dak Lak")
  const lower = province.toLowerCase();
  for (const [name, coords] of Object.entries(VN_PROVINCES)) {
    if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return coords;
    }
  }
  // Fallback to Vietnam centroid
  return [16.05, 108.22];
}

// ---------------------------------------------------------------------------
// Mac Mini FastAPI — primary data source
// ---------------------------------------------------------------------------
interface HotspotItem {
  disease: string;
  province: string;
  day: string;
  peak_alert: string;
  peak_cases: number | null;
  article_count: number;
  source_types: string;
  source_urls: string;
}

/** Return last 7 days as YYYY-MM-DD strings, newest first. */
function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().split('T')[0];
  });
}

function mapHotspots(hotspots: HotspotItem[]): Record<string, unknown>[] {
  return hotspots.map(h => {
    const province = String(h.province ?? '');
    const coords = resolveProvinceCoords(province);
    return {
      id: `pipeline:${h.disease}:${h.province}:${h.day}`,
      disease: String(h.disease ?? ''),
      country: 'Vietnam',
      countryCode: 'VN',
      alertLevel: (h.peak_alert as 'alert' | 'warning' | 'watch') ?? 'watch',
      title: `${diseaseLabel(String(h.disease ?? ''))} tại ${h.province}`,
      summary: `${h.article_count} nguồn (${h.source_types}). Số ca: ${h.peak_cases ?? 'N/A'}`,
      url: String((h.source_urls as string)?.split('|')[0] ?? ''),
      publishedAt: new Date(String(h.day)).getTime(),
      province,
      lat: coords?.[0],
      lng: coords?.[1],
      source: `pipeline:${String(h.source_types ?? '')}`,
      cases: h.peak_cases ? Number(h.peak_cases) : undefined,
    };
  });
}

async function fetchDayHotspots(apiUrl: string, apiKey: string, day: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${apiUrl}/hotspots?day=${day}`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json() as { hotspots: HotspotItem[] };
  return mapHotspots(data.hotspots ?? []);
}

/** Fetch last 7 days of hotspots in parallel — returns all items sorted newest first. */
async function fetchPipelineHotspots(): Promise<Record<string, unknown>[]> {
  const apiUrl = process.env.EPIDEMIC_API_URL;
  const apiKey = process.env.EPIDEMIC_API_KEY;
  if (!apiUrl || !apiKey) return [];

  const days = getLast7Days();
  const results = await Promise.allSettled(days.map(day => fetchDayHotspots(apiUrl, apiKey, day)));

  const all: Record<string, unknown>[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  // Sort newest first so LLM context builder gets today's data at top
  return all.sort((a, b) => (b.publishedAt as number) - (a.publishedAt as number));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ outbreaks: unknown[]; fetchedAt: number; sources: string[] }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 600);

  try {
    const outbreaks = await fetchPipelineHotspots();
    const payload = { outbreaks, fetchedAt: Date.now(), sources: outbreaks.length > 0 ? ['pipeline'] : [] };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 600);
  } catch (err) {
    // Mac Mini offline — return empty payload, UI shows "no data" gracefully
    const payload = { outbreaks: [], fetchedAt: Date.now(), sources: [], error: err instanceof Error ? err.message : 'Pipeline offline' };
    return jsonResponse(payload, 200, 60); // short cache so next request retries quickly
  }
}

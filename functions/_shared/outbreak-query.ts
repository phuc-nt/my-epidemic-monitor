/**
 * Shared D1 query logic for outbreak hotspots.
 * Used by outbreaks.ts, stats.ts, and countries.ts to avoid internal HTTP self-calls.
 */
import { diseaseLabel } from './disease-labels';
import { casesPerMillion, populationK } from './vn-province-population';

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
  // 'Gia Lai' same spelling in EN/VN — already defined above
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
  // 'Long An' same spelling in EN/VN — already defined above
  'Tiền Giang': [10.35, 106.36],
  'Bến Tre': [10.24, 106.38],
  'Trà Vinh': [9.95, 106.34],
  'Vĩnh Long': [10.25, 105.97],
  'Đồng Tháp': [10.45, 105.63],
  // 'An Giang' same spelling in EN/VN — already defined above
  'Kiên Giang': [10.01, 105.08],
  'Bạc Liêu': [9.29, 105.72],
  'Cà Mau': [9.18, 105.15],
  'Sóc Trăng': [9.60, 105.98],
  'Hậu Giang': [9.78, 105.47],
  'Tây Ninh': [11.31, 106.10],
  'Bình Phước': [11.75, 106.72],
  'Bà Rịa - Vũng Tàu': [10.50, 107.17], 'Vũng Tàu': [10.35, 107.08],
  // 'Kon Tum' same spelling in EN/VN — already defined above
  'Ninh Thuận': [11.58, 108.99],
  'Đắk Nông': [12.00, 107.69],
  'Quảng Ngãi': [15.12, 108.80],
  // Regional/aggregate terms from pipeline
  'Toàn quốc': [16.05, 108.22],
  'phía Nam': [10.50, 106.50],
  'ĐBSCL': [10.00, 105.50],
};

export function resolveProvinceCoords(province: string): [number, number] {
  if (VN_PROVINCES[province]) return VN_PROVINCES[province]!;
  const lower = province.toLowerCase();
  for (const [name, coords] of Object.entries(VN_PROVINCES)) {
    if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return coords;
    }
  }
  return [16.05, 108.22]; // Vietnam centroid fallback
}

interface HotspotRow {
  disease: string;
  province: string;
  district: string | null;
  day: string;
  peak_alert: string;
  peak_cases: number | null;
  article_count: number;
  source_types: string;
  source_urls: string;
}

export interface OutbreakItem {
  id: string;
  disease: string;
  country: string;
  countryCode: string;
  alertLevel: 'alert' | 'warning' | 'watch';
  title: string;
  summary: string;
  url: string;
  publishedAt: number;
  province: string;
  district?: string;
  lat?: number;
  lng?: number;
  source: string;
  cases?: number;
}

/**
 * Cap the pipeline-reported alert level by cases-per-million inhabitants
 * instead of absolute case count. This prevents two failure modes at once:
 *
 *   1. "1 ca × 100 báo re-up → cả tỉnh đỏ chét" (Anh Dũng Phan #2)
 *   2. "Đông dân thì đỏ chét → chứng minh sự thật hiển nhiên"
 *      (Anh Dũng Phan #3 — TP.HCM 9M dân sẽ luôn có nhiều tin hơn
 *       Lai Châu 500k dân dù dịch thực tế không chênh lệch)
 *
 * Thresholds (per million inhabitants):
 *   >= 50 / 1M → alert   (e.g. ~470+ ca TP.HCM, ~30 ca Lai Châu)
 *   >= 10 / 1M → warning (e.g. ~95 ca TP.HCM, ~5 ca Lai Châu)
 *   <  10 / 1M → watch
 *   null/0     → watch
 *
 * These match roughly "many tin" vs "a few tin" vs "one tin" intuition.
 */
function capAlertByCases(
  peakAlert: 'alert' | 'warning' | 'watch',
  cases: number | null | undefined,
  province: string,
): 'alert' | 'warning' | 'watch' {
  const n = cases ?? 0;
  const perM = n > 0 ? casesPerMillion(n, province) : 0;
  const LEVEL = { watch: 1, warning: 2, alert: 3 } as const;
  const REVERSE = ['', 'watch', 'warning', 'alert'] as const;
  let cap: 1 | 2 | 3 = 1;
  if (perM >= 50) cap = 3;
  else if (perM >= 10) cap = 2;
  else cap = 1;
  const original = LEVEL[peakAlert] ?? 1;
  const final = Math.min(original, cap) as 1 | 2 | 3;
  return REVERSE[final] as 'alert' | 'warning' | 'watch';
}

/**
 * Extract primary publisher name from a pipe-separated URL list.
 * E.g. "https://vnexpress.net/...|https://tuoitre.vn/..." → "vnexpress.net".
 */
function extractPrimaryPublisher(sourceUrls: string): string {
  const firstUrl = sourceUrls.split('|')[0] ?? '';
  try {
    const u = new URL(firstUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function mapHotspots(hotspots: HotspotRow[]): OutbreakItem[] {
  return hotspots.map(h => {
    const province = String(h.province ?? '');
    const coords = resolveProvinceCoords(province);
    const districtIdSuf = h.district ? `:${h.district}` : '';
    const cases = h.peak_cases ? Number(h.peak_cases) : undefined;
    const alertLevel = capAlertByCases(
      (h.peak_alert as 'alert' | 'warning' | 'watch') ?? 'watch',
      cases,
      province,
    );
    const articleCount = Number(h.article_count ?? 1);
    const primarySource = extractPrimaryPublisher(String(h.source_urls ?? ''));
    const locationPart = h.district ? `${h.district}, ${province}` : province;
    // Legal-safe wording: frame the item as "báo chí đưa tin về…" instead of
    // asserting an outbreak exists. All claims are attributed to the source.
    const title = articleCount >= 2
      ? `${articleCount} báo đưa tin: ${diseaseLabel(String(h.disease ?? ''))} tại ${locationPart}`
      : `${primarySource || 'Báo chí'} đưa tin: ${diseaseLabel(String(h.disease ?? ''))} tại ${locationPart}`;
    let casesPart: string;
    if (cases != null) {
      const perM = casesPerMillion(cases, province);
      const perMStr = perM >= 1 ? `~${perM.toFixed(0)}/1M dân` : `<1/1M dân`;
      casesPart = `Số ca được báo chí đề cập: ~${cases.toLocaleString('vi-VN')} (${perMStr}, chưa xác minh độc lập)`;
    } else {
      casesPart = 'Số ca cụ thể chưa được nêu rõ trong bài báo.';
    }
    const summary = `Theo ${articleCount} bài báo${primarySource ? ` (${primarySource})` : ''}. ${casesPart}`;
    // Suppress unused import warning — populationK is re-exported for
    // downstream consumers who may need raw population lookups.
    void populationK;
    return {
      id: `pipeline:${h.disease}:${h.province}${districtIdSuf}:${h.day}`,
      disease: String(h.disease ?? ''),
      country: 'Vietnam',
      countryCode: 'VN',
      alertLevel,
      title,
      summary,
      url: String((h.source_urls as string)?.split('|')[0] ?? ''),
      publishedAt: new Date(String(h.day)).getTime(),
      province,
      district: h.district ?? undefined,
      lat: coords[0],
      lng: coords[1],
      source: `pipeline:${String(h.source_types ?? '')}`,
      cases,
    };
  });
}

/** Return last N days as YYYY-MM-DD strings, newest first. */
export function getLastNDays(n = 7): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().split('T')[0];
  });
}

/**
 * Query D1 for recent web-sourced outbreak hotspots.
 *
 * Uses a 14-day rolling window on `published_at` so the UI stays populated
 * even when Vietnamese newspapers lag (they routinely publish today's news
 * with published_at = yesterday or earlier). Single query, grouped by
 * (disease, province, district, published day).
 *
 * Only web-sourced items are surfaced to the UI. YouTube/Facebook items
 * are still ingested into D1 for reference but hidden here.
 */
const WHITELISTED_SOURCE_TYPES = ['web'];
const WINDOW_DAYS = 14;

export async function fetchOutbreaksFromD1(db: D1Database): Promise<OutbreakItem[]> {
  const result = await db.prepare(`
    SELECT
      disease,
      province,
      district,
      strftime('%Y-%m-%d', published_at/1000, 'unixepoch') AS day,
      CASE MAX(CASE alert_level WHEN 'alert' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END)
        WHEN 3 THEN 'alert' WHEN 2 THEN 'warning' ELSE 'watch'
      END AS peak_alert,
      MAX(cases) AS peak_cases,
      COUNT(*) AS article_count,
      GROUP_CONCAT(DISTINCT source_type) AS source_types,
      GROUP_CONCAT(url, '|') AS source_urls
    FROM outbreak_items
    WHERE source_type IN (${WHITELISTED_SOURCE_TYPES.map(() => '?').join(',')})
      AND published_at > (strftime('%s','now') - ? * 86400) * 1000
      AND disease NOT IN ('african-swine-fever', 'avian-influenza')
      -- VN-only guard (layer 1): LLM-extracted country must be Vietnam or null.
      AND (country IS NULL OR LOWER(country) IN ('vietnam', 'viet nam', 'việt nam', 'vn'))
      -- VN-only guard (layer 2): reject titles that obviously name a foreign
      -- country. Catches VN newspapers reporting on foreign outbreaks where
      -- M2.7 failed to tag country (e.g. Thanh Niên Bangladesh measles).
      AND LOWER(title) NOT GLOB '*bangladesh*'
      AND LOWER(title) NOT GLOB '*pakistan*'
      AND LOWER(title) NOT GLOB '*argentina*'
      AND LOWER(title) NOT GLOB '*florida*'
      AND LOWER(title) NOT GLOB '*texas*'
      AND LOWER(title) NOT GLOB '*nigeria*'
      AND LOWER(title) NOT GLOB '*philippines*'
      AND LOWER(title) NOT GLOB '*indonesia*'
      AND LOWER(title) NOT GLOB '*thái lan*'
      AND LOWER(title) NOT GLOB '*singapore*'
      AND LOWER(title) NOT GLOB '*malaysia*'
      AND LOWER(title) NOT GLOB '*cambodia*'
      AND LOWER(title) NOT GLOB '*trung quốc*'
      AND LOWER(title) NOT GLOB '*china*'
      AND LOWER(title) NOT GLOB '*châu phi*'
      AND LOWER(title) NOT GLOB '*africa*'
      AND LOWER(title) NOT GLOB '*mỹ *'
      AND LOWER(title) NOT GLOB '* usa *'
    GROUP BY disease, province, IFNULL(district, ''), day
    ORDER BY day DESC,
      MAX(CASE alert_level WHEN 'alert' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END) DESC
  `).bind(...WHITELISTED_SOURCE_TYPES, WINDOW_DAYS).all<HotspotRow>();

  return mapHotspots(result.results ?? []).sort((a, b) => b.publishedAt - a.publishedAt);
}

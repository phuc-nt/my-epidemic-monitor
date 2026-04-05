/**
 * WHO Disease Outbreak News (DON) RSS feed proxy.
 * Parses XML via regex (Edge Runtime has no DOMParser).
 * Returns DiseaseOutbreakItem[] normalised from RSS <item> elements.
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'outbreaks';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** RSS sources for outbreak data — WHO DON + Vietnamese health news */
const OUTBREAK_SOURCES = [
  { name: 'WHO-DON', url: 'https://www.who.int/feeds/entity/don/en/rss.xml' },
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/suc-khoe.rss' },
  { name: 'VietnamNet', url: 'https://vietnamnet.vn/suc-khoe.rss' },
  { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
  { name: 'Dân Trí', url: 'https://dantri.com.vn/rss/suc-khoe.rss' },
];

/**
 * Vietnamese disease keywords → normalized disease name + alert level hint.
 * Used to extract outbreak items from general health news articles.
 */
const VN_DISEASE_KEYWORDS: { pattern: RegExp; disease: string; alert: 'alert' | 'warning' | 'watch' }[] = [
  { pattern: /sốt xuất huyết|dengue|sxh/i, disease: 'Sốt xuất huyết (Dengue)', alert: 'warning' },
  { pattern: /tay chân miệng|hand.?foot|hfmd/i, disease: 'Tay chân miệng (HFMD)', alert: 'warning' },
  { pattern: /covid|sars.?cov|corona/i, disease: 'COVID-19', alert: 'watch' },
  { pattern: /cúm\s*a|influenza\s*a|h[0-9]n[0-9]/i, disease: 'Cúm A (Influenza A)', alert: 'watch' },
  { pattern: /cúm gia cầm|avian|bird flu|h5n1/i, disease: 'Cúm gia cầm (Avian Influenza)', alert: 'alert' },
  { pattern: /sởi|measles/i, disease: 'Sởi (Measles)', alert: 'warning' },
  { pattern: /bạch hầu|diphtheria/i, disease: 'Bạch hầu (Diphtheria)', alert: 'alert' },
  { pattern: /tả|cholera/i, disease: 'Tả (Cholera)', alert: 'alert' },
  { pattern: /ho gà|pertussis|whooping/i, disease: 'Ho gà (Pertussis)', alert: 'warning' },
  { pattern: /dại|rabies/i, disease: 'Dại (Rabies)', alert: 'warning' },
  { pattern: /viêm não|encephalitis|japanese encephalitis/i, disease: 'Viêm não Nhật Bản (JE)', alert: 'warning' },
  { pattern: /thương hàn|typhoid/i, disease: 'Thương hàn (Typhoid)', alert: 'warning' },
  { pattern: /ebola/i, disease: 'Ebola', alert: 'alert' },
  { pattern: /marburg/i, disease: 'Marburg', alert: 'alert' },
  { pattern: /mpox|đậu mùa khỉ/i, disease: 'Mpox', alert: 'warning' },
  { pattern: /lao|tuberculosis|tb\b/i, disease: 'Lao (Tuberculosis)', alert: 'watch' },
  { pattern: /sốt rét|malaria/i, disease: 'Sốt rét (Malaria)', alert: 'warning' },
  { pattern: /hiv|aids/i, disease: 'HIV/AIDS', alert: 'watch' },
  { pattern: /viêm gan|hepatitis/i, disease: 'Viêm gan (Hepatitis)', alert: 'watch' },
  { pattern: /dịch hạch|plague/i, disease: 'Dịch hạch (Plague)', alert: 'alert' },
];

// ISO alpha-2 lookup by common English country name
const COUNTRY_CODES: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Angola': 'AO',
  'Argentina': 'AR', 'Australia': 'AU', 'Austria': 'AT', 'Bangladesh': 'BD',
  'Belgium': 'BE', 'Bolivia': 'BO', 'Brazil': 'BR', 'Cambodia': 'KH',
  'Cameroon': 'CM', 'Canada': 'CA', 'Chad': 'TD', 'Chile': 'CL',
  'China': 'CN', 'Colombia': 'CO', 'Congo': 'CG', 'Cuba': 'CU',
  'Democratic Republic of the Congo': 'CD', 'DRC': 'CD',
  'Ecuador': 'EC', 'Egypt': 'EG', 'Ethiopia': 'ET', 'France': 'FR',
  'Germany': 'DE', 'Ghana': 'GH', 'Guatemala': 'GT', 'Guinea': 'GN',
  'Haiti': 'HT', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR',
  'Iraq': 'IQ', 'Italy': 'IT', 'Japan': 'JP', 'Jordan': 'JO',
  'Kenya': 'KE', 'Lebanon': 'LB', 'Libya': 'LY', 'Madagascar': 'MG',
  'Mali': 'ML', 'Mexico': 'MX', 'Morocco': 'MA', 'Mozambique': 'MZ',
  'Myanmar': 'MM', 'Nepal': 'NP', 'Netherlands': 'NL', 'Niger': 'NE',
  'Nigeria': 'NG', 'Pakistan': 'PK', 'Peru': 'PE', 'Philippines': 'PH',
  'Russia': 'RU', 'Rwanda': 'RW', 'Saudi Arabia': 'SA', 'Senegal': 'SN',
  'Sierra Leone': 'SL', 'Somalia': 'SO', 'South Africa': 'ZA',
  'South Sudan': 'SS', 'Spain': 'ES', 'Sudan': 'SD', 'Syria': 'SY',
  'Tanzania': 'TZ', 'Thailand': 'TH', 'Turkey': 'TR', 'Uganda': 'UG',
  'Ukraine': 'UA', 'United Kingdom': 'GB', 'United States': 'US',
  'USA': 'US', 'Venezuela': 'VE', 'Vietnam': 'VN', 'Yemen': 'YE',
  'Zambia': 'ZM', 'Zimbabwe': 'ZW',
};

// Country centroid lat/lng by ISO alpha-2
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [33.93, 67.71], AL: [41.15, 20.17], DZ: [28.03, 1.66], AO: [-11.20, 17.87],
  AR: [-38.42, -63.62], AU: [-25.27, 133.78], AT: [47.52, 14.55], BD: [23.68, 90.36],
  BE: [50.50, 4.47], BO: [-16.29, -63.59], BR: [-14.24, -51.93], KH: [12.57, 104.99],
  CM: [3.85, 11.50], CA: [56.13, -106.35], TD: [15.45, 18.73], CL: [-35.68, -71.54],
  CN: [35.86, 104.20], CO: [4.57, -74.30], CG: [-0.23, 15.83], CU: [21.52, -77.78],
  CD: [-4.04, 21.76], EC: [-1.83, -78.18], EG: [26.82, 30.80], ET: [9.15, 40.49],
  FR: [46.23, 2.21], DE: [51.17, 10.45], GH: [7.95, -1.02], GT: [15.78, -90.23],
  GN: [9.95, -11.24], HT: [18.97, -72.29], IN: [20.59, 78.96], ID: [-0.79, 113.92],
  IR: [32.43, 53.69], IQ: [33.22, 43.68], IT: [41.87, 12.57], JP: [36.20, 138.25],
  JO: [30.59, 36.24], KE: [-0.02, 37.91], LB: [33.85, 35.86], LY: [26.34, 17.23],
  MG: [-18.77, 46.87], ML: [17.57, -3.99], MX: [23.63, -102.55], MA: [31.79, -7.09],
  MZ: [-18.67, 35.53], MM: [21.92, 95.96], NP: [28.39, 84.12], NL: [52.13, 5.29],
  NE: [17.61, 8.08], NG: [9.08, 8.68], PK: [30.38, 69.35], PE: [-9.19, -75.02],
  PH: [12.88, 121.77], RU: [61.52, 105.32], RW: [-1.94, 29.87], SA: [23.89, 45.08],
  SN: [14.50, -14.45], SL: [8.46, -11.78], SO: [5.15, 46.20], ZA: [-30.56, 22.94],
  SS: [6.88, 31.31], ES: [40.46, -3.75], SD: [12.86, 30.22], SY: [34.80, 38.99],
  TZ: [-6.37, 34.89], TH: [15.87, 100.99], TR: [38.96, 35.24], UG: [1.37, 32.29],
  UA: [48.38, 31.17], GB: [55.38, -3.44], US: [37.09, -95.71], VE: [6.42, -66.59],
  VN: [16.05, 108.22], YE: [15.55, 48.52], ZM: [-13.13, 27.85], ZW: [-19.02, 29.15],
};

/**
 * Vietnam provinces — centroid lat/lng for sub-national outbreak mapping.
 * Used when outbreak title/description mentions a Vietnamese province.
 */
const VN_PROVINCES: Record<string, [number, number]> = {
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
};

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

function extractTagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTagContent(block, 'title'),
      link: extractTagContent(block, 'link') || extractTagContent(block, 'guid'),
      pubDate: extractTagContent(block, 'pubDate'),
      description: extractTagContent(block, 'description'),
    });
  }
  return items;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

function deriveDisease(title: string): string {
  const sep = title.indexOf(' - ');
  return sep !== -1 ? title.slice(0, sep).trim() : title.trim();
}

function deriveCountry(title: string): string {
  const sep = title.indexOf(' - ');
  return sep !== -1 ? title.slice(sep + 3).trim() : '';
}

function deriveAlertLevel(title: string): 'alert' | 'warning' | 'watch' {
  const lower = title.toLowerCase();
  if (lower.includes('outbreak') || lower.includes('emergency')) return 'alert';
  if (lower.includes('update') || lower.includes('additional')) return 'warning';
  return 'watch';
}

function lookupCountryCode(name: string): string {
  // Direct lookup
  if (COUNTRY_CODES[name]) return COUNTRY_CODES[name];
  // Partial match
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return code;
    }
  }
  return '';
}

/** Search text for a Vietnam province name, return name + centroid. */
function findVnProvince(text: string): { name: string; coords: [number, number] } | null {
  const lower = text.toLowerCase();
  for (const [name, coords] of Object.entries(VN_PROVINCES)) {
    if (lower.includes(name.toLowerCase())) return { name, coords };
  }
  return null;
}

/** Match disease from article text using VN_DISEASE_KEYWORDS. */
function matchDisease(text: string): { disease: string; alert: 'alert' | 'warning' | 'watch' } | null {
  for (const kw of VN_DISEASE_KEYWORDS) {
    if (kw.pattern.test(text)) return { disease: kw.disease, alert: kw.alert };
  }
  return null;
}

/** Upgrade alert level based on keyword cues in text. */
function refineAlertLevel(text: string, base: 'alert' | 'warning' | 'watch'): 'alert' | 'warning' | 'watch' {
  const lower = text.toLowerCase();
  if (/bùng phát|outbreak|emergency|tử vong|chết|deaths?|khẩn cấp/.test(lower)) return 'alert';
  if (/tăng mạnh|tăng cao|lan rộng|cảnh báo|warning|surge|increase/.test(lower)) return 'warning';
  return base;
}

// ---------------------------------------------------------------------------
// Parse WHO DON items (structured: "Disease - Country" title format)
// ---------------------------------------------------------------------------
interface OutbreakResult {
  id: string; disease: string; country: string; countryCode: string;
  alertLevel: 'alert' | 'warning' | 'watch';
  title: string; summary: string; url: string; publishedAt: number;
  lat?: number; lng?: number; province?: string; source: string;
}

function parseWhoDonItems(rssItems: RssItem[]): OutbreakResult[] {
  return rssItems.map((item) => {
    const country = deriveCountry(item.title);
    const countryCode = lookupCountryCode(country);
    const centroid = COUNTRY_CENTROIDS[countryCode];
    let lat = centroid?.[0];
    let lng = centroid?.[1];
    let province: string | undefined;
    if (countryCode === 'VN' || country.toLowerCase().includes('viet')) {
      const vnMatch = findVnProvince(item.title + ' ' + item.description);
      if (vnMatch) { lat = vnMatch.coords[0]; lng = vnMatch.coords[1]; province = vnMatch.name; }
    }
    return {
      id: hashString(item.link || item.title),
      disease: deriveDisease(item.title),
      country,
      countryCode: countryCode || (country.toLowerCase().includes('viet') ? 'VN' : ''),
      alertLevel: deriveAlertLevel(item.title),
      title: item.title,
      summary: item.description.replace(/<[^>]+>/g, '').slice(0, 300),
      url: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      lat, lng, province,
      source: 'WHO-DON',
    };
  });
}

// ---------------------------------------------------------------------------
// Parse Vietnamese news RSS → outbreak items (filter by disease keywords)
// ---------------------------------------------------------------------------
function parseVnNewsToOutbreaks(rssItems: RssItem[], sourceName: string): OutbreakResult[] {
  const results: OutbreakResult[] = [];
  for (const item of rssItems) {
    const text = item.title + ' ' + item.description;
    const match = matchDisease(text);
    if (!match) continue; // Skip non-disease articles

    const vnProvince = findVnProvince(text);
    const centroid = vnProvince?.coords ?? COUNTRY_CENTROIDS['VN'];
    const alertLevel = refineAlertLevel(text, match.alert);

    results.push({
      id: hashString(`${sourceName}:${item.link || item.title}`),
      disease: match.disease,
      country: 'Vietnam',
      countryCode: 'VN',
      alertLevel,
      title: item.title,
      summary: item.description.replace(/<[^>]+>/g, '').slice(0, 300),
      url: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      lat: centroid?.[0],
      lng: centroid?.[1],
      province: vnProvince?.name,
      source: sourceName,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// WHO DON REST API (replaces broken RSS feed)
// ---------------------------------------------------------------------------
async function fetchWhoDonApi(): Promise<OutbreakResult[]> {
  const url = 'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=30';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'EpidemicMonitor/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`WHO DON API ${res.status}`);
  const data: { value: Record<string, unknown>[] } = await res.json();
  return (data.value || []).map(item => {
    const title = typeof item.Title === 'object' ? (item.Title as Record<string, string>)?.Value ?? '' : String(item.Title ?? '');
    const summary = typeof item.Summary === 'object' ? (item.Summary as Record<string, string>)?.Value ?? '' : String(item.Summary ?? '');
    const urlPath = typeof item.ItemDefaultUrl === 'object' ? (item.ItemDefaultUrl as Record<string, string>)?.Value ?? '' : String(item.ItemDefaultUrl ?? '');
    const fullUrl = urlPath.startsWith('/') ? `https://www.who.int${urlPath}` : urlPath;
    const pubDate = String(item.PublicationDate ?? '');

    const country = deriveCountry(title);
    const countryCode = lookupCountryCode(country);
    const centroid = COUNTRY_CENTROIDS[countryCode];

    return {
      id: hashString(`WHO-DON:${fullUrl || title}`),
      disease: deriveDisease(title),
      country: country || 'Global',
      countryCode,
      alertLevel: deriveAlertLevel(title),
      title,
      summary: summary.replace(/<[^>]+>/g, '').slice(0, 300),
      url: fullUrl,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      lat: centroid?.[0],
      lng: centroid?.[1],
      source: 'WHO-DON',
    };
  });
}

// ---------------------------------------------------------------------------
// Main handler: fetch all sources in parallel, merge, deduplicate
// ---------------------------------------------------------------------------
async function fetchRssSource(source: { name: string; url: string }): Promise<OutbreakResult[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'EpidemicMonitor/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${source.name} RSS ${res.status}`);
  const xml = await res.text();
  const rssItems = parseRssItems(xml);
  return parseVnNewsToOutbreaks(rssItems, source.name);
}

/** Vietnamese news RSS sources (WHO-DON handled separately via REST API) */
const VN_RSS_SOURCES = OUTBREAK_SOURCES.filter(s => s.name !== 'WHO-DON');

// ---------------------------------------------------------------------------
// Pipeline hotspots — Mac Mini FastAPI via Cloudflare Tunnel
// ---------------------------------------------------------------------------
async function fetchPipelineHotspots(): Promise<OutbreakResult[]> {
  const apiUrl = process.env.EPIDEMIC_API_URL;
  const apiKey = process.env.EPIDEMIC_API_KEY;
  if (!apiUrl || !apiKey) return [];

  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${apiUrl}/hotspots?day=${today}`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Pipeline API ${res.status}`);
  const data: { hotspots: Record<string, unknown>[] } = await res.json();
  return (data.hotspots ?? []).map(h => ({
    id: hashString(`pipeline:${h.disease}:${h.province}:${h.day}`),
    disease: String(h.disease ?? ''),
    country: 'Vietnam',
    countryCode: 'VN',
    alertLevel: (h.peak_alert as 'alert' | 'warning' | 'watch') ?? 'watch',
    title: `${h.disease} tại ${h.province}`,
    summary: `${h.article_count} nguồn (${h.source_types}). Số ca: ${h.peak_cases ?? 'N/A'}`,
    url: String((h.source_urls as string)?.split('|')[0] ?? ''),
    publishedAt: new Date(String(h.day)).getTime(),
    province: String(h.province ?? ''),
    source: `pipeline:${String(h.source_types ?? '')}`,
    cases: h.peak_cases ? Number(h.peak_cases) : undefined,
  }));
}

export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ outbreaks: unknown[]; fetchedAt: number; sources: string[] }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 600);

  try {
    // Fetch WHO DON REST API + pipeline hotspots + VN news RSS feeds in parallel
    const [whoDonResult, pipelineResult, ...rssResults] = await Promise.allSettled([
      fetchWhoDonApi(),
      fetchPipelineHotspots(),
      ...VN_RSS_SOURCES.map(fetchRssSource),
    ]);

    const allOutbreaks: OutbreakResult[] = [];
    const successSources: string[] = [];

    // WHO DON API results
    if (whoDonResult.status === 'fulfilled') {
      allOutbreaks.push(...whoDonResult.value);
      successSources.push('WHO-DON');
    }

    // Pipeline hotspots from Mac Mini (graceful fallback if offline)
    if (pipelineResult.status === 'fulfilled' && pipelineResult.value.length > 0) {
      allOutbreaks.push(...pipelineResult.value);
      successSources.push('pipeline');
    }

    // VN RSS results
    for (let i = 0; i < rssResults.length; i++) {
      const result = rssResults[i];
      if (result.status === 'fulfilled') {
        allOutbreaks.push(...result.value);
        successSources.push(VN_RSS_SOURCES[i].name);
      }
    }

    // Deduplicate by id, sort by date desc
    const seen = new Set<string>();
    const outbreaks = allOutbreaks
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => b.publishedAt - a.publishedAt);

    const payload = { outbreaks, fetchedAt: Date.now(), sources: successSources };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 600);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch outbreaks');
  }
}

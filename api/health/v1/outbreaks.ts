/**
 * WHO Disease Outbreak News (DON) RSS feed proxy.
 * Parses XML via regex (Edge Runtime has no DOMParser).
 * Returns DiseaseOutbreakItem[] normalised from RSS <item> elements.
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'outbreaks';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const WHO_DON_RSS = 'https://www.who.int/feeds/entity/don/en/rss.xml';

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
  VN: [14.06, 108.28], YE: [15.55, 48.52], ZM: [-13.13, 27.85], ZW: [-19.02, 29.15],
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

export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ outbreaks: unknown[]; fetchedAt: number }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 300);

  try {
    const res = await fetch(WHO_DON_RSS, {
      headers: { 'User-Agent': 'EpidemicMonitor/1.0' },
    });
    if (!res.ok) throw new Error(`WHO RSS ${res.status}`);

    const xml = await res.text();
    const rssItems = parseRssItems(xml);

    const outbreaks = rssItems.map((item) => {
      const country = deriveCountry(item.title);
      const countryCode = lookupCountryCode(country);
      const centroid = COUNTRY_CENTROIDS[countryCode];
      return {
        id: hashString(item.link || item.title),
        disease: deriveDisease(item.title),
        country,
        countryCode,
        alertLevel: deriveAlertLevel(item.title),
        title: item.title,
        summary: item.description.replace(/<[^>]+>/g, '').slice(0, 300),
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        lat: centroid?.[0],
        lng: centroid?.[1],
      };
    });

    const payload = { outbreaks, fetchedAt: Date.now() };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 300);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch outbreaks');
  }
}

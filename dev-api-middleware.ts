/**
 * Vite dev middleware — proxies /api/health/v1/* routes by fetching real RSS feeds.
 * Only active in dev mode. In production, Vercel Edge Functions handle these routes.
 */
import type { Plugin } from 'vite';

// In-memory cache for dev mode
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) { cache.delete(key); return undefined; }
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// ---------------------------------------------------------------------------
// RSS parsing (same regex approach as Edge functions)
// ---------------------------------------------------------------------------
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractLink(block: string): string {
  // Handle both plain text and CDATA-wrapped links
  const lm = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s);
  if (lm && lm[1].trim()) return lm[1].trim();
  const gm = block.match(/<guid[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>/s);
  return gm ? gm[1].trim() : '';
}

function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, '').trim(); }

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

interface RssItem { title: string; link: string; pubDate: string; description: string; }

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    items.push({
      title: stripHtml(extractTag(b, 'title')),
      link: extractLink(b),
      pubDate: extractTag(b, 'pubDate') || extractTag(b, 'dc:date'),
      description: stripHtml(extractTag(b, 'description') || extractTag(b, 'summary')).slice(0, 300),
    });
  }
  return items;
}

async function fetchRss(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EpidemicMonitor/1.0-dev', Accept: 'application/rss+xml, text/xml, application/xml' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}: ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Disease keyword matching for Vietnamese news
// ---------------------------------------------------------------------------
const VN_DISEASE_KW = [
  { p: /sốt xuất huyết|dengue|sxh/i, d: 'Sốt xuất huyết (Dengue)', a: 'warning' as const },
  { p: /tay chân miệng|hand.?foot|hfmd/i, d: 'Tay chân miệng (HFMD)', a: 'warning' as const },
  { p: /covid|sars.?cov|corona/i, d: 'COVID-19', a: 'watch' as const },
  { p: /cúm\s*a|influenza\s*a|h[0-9]n[0-9]/i, d: 'Cúm A (Influenza A)', a: 'watch' as const },
  { p: /cúm gia cầm|avian|bird flu|h5n1/i, d: 'Cúm gia cầm (Avian Influenza)', a: 'alert' as const },
  { p: /sởi|measles/i, d: 'Sởi (Measles)', a: 'warning' as const },
  { p: /bạch hầu|diphtheria/i, d: 'Bạch hầu (Diphtheria)', a: 'alert' as const },
  { p: /tả|cholera/i, d: 'Tả (Cholera)', a: 'alert' as const },
  { p: /ho gà|pertussis/i, d: 'Ho gà (Pertussis)', a: 'warning' as const },
  { p: /dại|rabies/i, d: 'Dại (Rabies)', a: 'warning' as const },
  { p: /viêm não|encephalitis/i, d: 'Viêm não Nhật Bản (JE)', a: 'warning' as const },
  { p: /ebola/i, d: 'Ebola', a: 'alert' as const },
  { p: /mpox|đậu mùa khỉ/i, d: 'Mpox', a: 'warning' as const },
  { p: /lao|tuberculosis|tb\b/i, d: 'Lao (Tuberculosis)', a: 'watch' as const },
  { p: /sốt rét|malaria/i, d: 'Sốt rét (Malaria)', a: 'warning' as const },
  { p: /viêm gan|hepatitis/i, d: 'Viêm gan (Hepatitis)', a: 'watch' as const },
  { p: /thủy đậu|chickenpox|varicella/i, d: 'Thủy đậu (Chickenpox)', a: 'watch' as const },
  { p: /bệnh dại|whitmore|melioidosis/i, d: 'Whitmore (Melioidosis)', a: 'warning' as const },
];

/** All 63 provinces + 5 municipalities with diacritic + non-diacritic variants */
const VN_PROVINCES: Record<string, [number, number]> = {
  // 5 municipalities
  'Hà Nội': [21.03, 105.85], 'Ha Noi': [21.03, 105.85],
  'Hồ Chí Minh': [10.82, 106.63], 'Ho Chi Minh': [10.82, 106.63], 'TPHCM': [10.82, 106.63], 'TP.HCM': [10.82, 106.63], 'Sài Gòn': [10.82, 106.63],
  'Đà Nẵng': [16.05, 108.22], 'Da Nang': [16.05, 108.22],
  'Hải Phòng': [20.86, 106.68], 'Hai Phong': [20.86, 106.68],
  'Cần Thơ': [10.04, 105.79], 'Can Tho': [10.04, 105.79],
  // Northern provinces
  'Hà Giang': [22.83, 104.98], 'Cao Bằng': [22.67, 106.26], 'Bắc Kạn': [22.15, 105.83],
  'Tuyên Quang': [21.78, 105.21], 'Lào Cai': [22.49, 103.97], 'Yên Bái': [21.72, 104.87],
  'Thái Nguyên': [21.59, 105.85], 'Lạng Sơn': [21.85, 106.76], 'Quảng Ninh': [21.01, 107.29],
  'Bắc Giang': [21.27, 106.19], 'Phú Thọ': [21.42, 105.23], 'Vĩnh Phúc': [21.31, 105.60],
  'Bắc Ninh': [21.19, 106.07], 'Hải Dương': [20.94, 106.31], 'Hưng Yên': [20.65, 106.06],
  'Thái Bình': [20.45, 106.34], 'Hà Nam': [20.58, 105.92], 'Nam Định': [20.43, 106.16],
  'Ninh Bình': [20.25, 105.97], 'Hòa Bình': [20.81, 105.34],
  'Sơn La': [21.33, 103.91], 'Lai Châu': [22.39, 103.46], 'Điện Biên': [21.39, 103.02],
  // Central provinces
  'Thanh Hóa': [19.81, 105.78], 'Nghệ An': [18.97, 105.17], 'Hà Tĩnh': [18.34, 105.91],
  'Quảng Bình': [17.47, 106.60], 'Quảng Trị': [16.75, 107.19],
  'Thừa Thiên Huế': [16.47, 107.60], 'Huế': [16.47, 107.60],
  'Quảng Nam': [15.57, 108.47], 'Quảng Ngãi': [15.12, 108.80],
  'Bình Định': [13.78, 109.22], 'Phú Yên': [13.09, 109.09], 'Khánh Hòa': [12.25, 109.05],
  'Ninh Thuận': [11.58, 108.99], 'Bình Thuận': [11.09, 108.07],
  // Highlands
  'Kon Tum': [14.35, 108.00], 'Gia Lai': [13.98, 108.00],
  'Đắk Lắk': [12.71, 108.24], 'Đắk Nông': [12.00, 107.69], 'Lâm Đồng': [11.94, 108.44],
  // Southern provinces
  'Bình Phước': [11.75, 106.72], 'Tây Ninh': [11.31, 106.10],
  'Bình Dương': [11.17, 106.65], 'Đồng Nai': [10.95, 106.82],
  'Bà Rịa Vũng Tàu': [10.50, 107.17], 'Vũng Tàu': [10.35, 107.08],
  // Mekong Delta
  'Long An': [10.54, 106.41], 'Tiền Giang': [10.35, 106.36], 'Bến Tre': [10.24, 106.38],
  'Trà Vinh': [9.95, 106.34], 'Vĩnh Long': [10.25, 105.97], 'Đồng Tháp': [10.45, 105.63],
  'An Giang': [10.52, 105.13], 'Kiên Giang': [10.01, 105.08],
  'Hậu Giang': [9.78, 105.47], 'Sóc Trăng': [9.60, 105.98],
  'Bạc Liêu': [9.29, 105.72], 'Cà Mau': [9.18, 105.15],
};

/** Remove Vietnamese diacritics for fuzzy province matching in article text */
function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

function matchDisease(text: string) {
  for (const kw of VN_DISEASE_KW) {
    if (kw.p.test(text)) return { disease: kw.d, alert: kw.a };
  }
  return null;
}

function findProvince(text: string) {
  // Try exact match first (with diacritics)
  for (const [name, coords] of Object.entries(VN_PROVINCES)) {
    if (text.includes(name)) return { name, coords };
  }
  // Fallback: normalized match (remove diacritics from both)
  const normText = removeDiacritics(text);
  for (const [name, coords] of Object.entries(VN_PROVINCES)) {
    if (normText.includes(removeDiacritics(name))) return { name, coords };
  }
  return null;
}

function refineAlert(text: string, base: string) {
  const l = text.toLowerCase();
  if (/bùng phát|tử vong|chết|khẩn cấp|outbreak|emergency/.test(l)) return 'alert';
  if (/tăng mạnh|tăng cao|lan rộng|cảnh báo/.test(l)) return 'warning';
  return base;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleNews(): Promise<unknown> {
  const cached = getCached<unknown>('news');
  if (cached) return cached;

  const sources = [
    { name: 'VnExpress', url: 'https://vnexpress.net/rss/suc-khoe.rss' },
    { name: 'VietnamNet', url: 'https://vietnamnet.vn/suc-khoe.rss' },
    { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
    { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
    { name: 'Dân Trí', url: 'https://dantri.com.vn/rss/suc-khoe.rss' },
    { name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml' },
    { name: 'CDC-EID', url: 'https://wwwnc.cdc.gov/eid/rss/upcoming.xml' },
  ];

  const results = await Promise.allSettled(sources.map(async (s) => {
    const xml = await fetchRss(s.url);
    return parseRssItems(xml).map(item => ({
      id: hashStr(`${s.name}:${item.link || item.title}`),
      title: item.title,
      source: s.name,
      url: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      summary: item.description,
    }));
  }));

  const items: unknown[] = [];
  const okSources: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      items.push(...(results[i] as PromiseFulfilledResult<unknown[]>).value);
      okSources.push(sources[i].name);
    }
  }

  const seen = new Set<string>();
  const deduped = (items as Array<{ id: string; publishedAt: number }>)
    .filter(it => { if (seen.has(it.id)) return false; seen.add(it.id); return true; })
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 50);

  const payload = { items: deduped, fetchedAt: Date.now(), sources: okSources };
  setCached('news', payload, 10 * 60_000);
  return payload;
}

// ---------------------------------------------------------------------------
// Server-side LLM enrichment — crawl article + extract cases/district/ward
// ---------------------------------------------------------------------------
interface OutbreakItem {
  id: string; disease: string; country: string; countryCode: string;
  alertLevel: string; title: string; summary: string; url: string;
  publishedAt: number; lat?: number; lng?: number; province?: string;
  district?: string; cases?: number; deaths?: number; source: string;
  isOutbreakNews?: boolean;
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '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';

const LLM_EXTRACTION_PROMPT = `Bạn là chuyên gia phân tích dữ liệu dịch bệnh. Extract thông tin từ bài báo y tế Việt Nam.
Trả về JSON với các trường:
- disease_vn: tên bệnh tiếng Việt
- province: tên tỉnh/thành. null nếu không có
- district: tên quận/huyện. null nếu không có
- ward: tên phường/xã. null nếu không có
- cases: số ca bệnh (int). null nếu không đề cập
- deaths: số tử vong (int). null nếu không đề cập
- severity: "outbreak" | "warning" | "watch"
- date: ngày sự kiện (YYYY-MM-DD). null nếu không rõ
- is_outbreak_news: true nếu tin dịch bệnh CỤ THỂ (có ca, có địa điểm), false nếu bài hướng dẫn sức khỏe chung
- summary_vi: tóm tắt 1 câu
Return JSON ONLY.`;

/** Call minimax m2.7 via OpenRouter to extract structured data from article text */
async function llmExtract(articleText: string): Promise<Record<string, unknown> | null> {
  if (!OPENROUTER_KEY || articleText.length < 100) return null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.7',
        messages: [
          { role: 'system', content: LLM_EXTRACTION_PROMPT },
          { role: 'user', content: articleText.slice(0, 3000) },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content.replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
  } catch {
    return null;
  }
}

/** Fetch article via simple HTTP + extract entities with LLM. Fast path (no crawl4ai browser). */
async function fetchAndExtract(url: string): Promise<Record<string, unknown> | null> {
  const cacheKey = `enriched:${url}`;
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  try {
    // Simple fetch (works for VnExpress, Tuổi Trẻ SSR pages)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpidemicMonitor/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract article body
    const bodyPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*(?:fck_detail|article-body|content-detail|singular-content|detail-content|the-article-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];
    let body = '';
    for (const p of bodyPatterns) {
      const m = html.match(p);
      if (m) { body = m[1] || m[0]; if (body.length > 200) break; }
    }
    // Fallback: strip all HTML
    if (body.length < 100) body = html;
    body = body.replace(/<[^>]+>/g, '').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    if (body.length < 100) return null;

    // LLM extract via minimax m2.7
    const extracted = await llmExtract(body);
    if (extracted) {
      console.info(`[enrich] ✓ ${url.slice(0, 40)} → cases=${extracted.cases} dist=${extracted.district} outbreak=${extracted.is_outbreak_news}`);
      setCached(cacheKey, extracted, 6 * 60 * 60_000);
    }
    return extracted;
  } catch {
    return null;
  }
}

/** Enrich top N outbreak items with simple fetch + LLM extraction */
async function enrichTopArticles(items: OutbreakItem[]): Promise<void> {
  // Only enrich VN news items (not WHO-DON, which already has structure)
  const vnItems = items.filter(o => o.source !== 'WHO-DON' && o.url && o.url.length > 30);
  // Enrich top 10 most recent — sequential to avoid rate limits
  const toEnrich = vnItems.slice(0, 10);

  // Run in batches of 3 (parallel within batch, sequential between batches)
  const results: Array<Record<string, unknown> | null> = new Array(toEnrich.length).fill(null);
  for (let batch = 0; batch < toEnrich.length; batch += 3) {
    const batchItems = toEnrich.slice(batch, batch + 3);
    const batchResults = await Promise.allSettled(
      batchItems.map(item => fetchAndExtract(item.url))
    );
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      results[batch + j] = r.status === 'fulfilled' ? r.value : null;
    }
  }

  for (let i = 0; i < results.length; i++) {
    const extracted = results[i];
    if (!extracted) continue;
    const item = toEnrich[i];

    // Apply extracted data
    if (extracted.cases != null) item.cases = Number(extracted.cases) || undefined;
    if (extracted.deaths != null) item.deaths = Number(extracted.deaths) || undefined;
    if (extracted.district) item.district = String(extracted.district);
    if (extracted.ward) item.district = `${extracted.ward}, ${extracted.district || ''}`.trim();
    if (extracted.province && !item.province) item.province = String(extracted.province);
    if (extracted.is_outbreak_news === false) item.isOutbreakNews = false;
    if (extracted.severity === 'outbreak') item.alertLevel = 'alert';
    if (extracted.summary_vi) item.summary = String(extracted.summary_vi);

    // Update coordinates if we got a more specific location
    const locText = `${extracted.ward || ''} ${extracted.district || ''} ${extracted.province || ''}`;
    const wardMatch = findProvince(locText);
    if (wardMatch) { item.lat = wardMatch.coords[0]; item.lng = wardMatch.coords[1]; }
  }

  // Filter out non-outbreak health guides
  const removeIndices = new Set<number>();
  for (let i = items.length - 1; i >= 0; i--) {
    if ((items[i] as OutbreakItem).isOutbreakNews === false) removeIndices.add(i);
  }
  // Remove from end to preserve indices
  for (const idx of Array.from(removeIndices).sort((a, b) => b - a)) {
    items.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
// WHO Disease Outbreak News REST API — structured global outbreak data
// ---------------------------------------------------------------------------
async function fetchWhoDon(): Promise<unknown[]> {
  const url = 'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=30';
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`WHO DON API ${res.status}`);
  const data = await res.json() as { value: Array<Record<string, unknown>> };
  return (data.value || []).map(item => {
    const title = typeof item.Title === 'object' ? (item.Title as Record<string, string>)?.Value ?? '' : String(item.Title ?? '');
    const summary = typeof item.Summary === 'object' ? (item.Summary as Record<string, string>)?.Value ?? '' : String(item.Summary ?? '');
    const urlPath = typeof item.ItemDefaultUrl === 'object' ? (item.ItemDefaultUrl as Record<string, string>)?.Value ?? '' : String(item.ItemDefaultUrl ?? '');
    const fullUrl = urlPath.startsWith('/') ? `https://www.who.int${urlPath}` : urlPath;
    const pubDate = String(item.PublicationDate ?? '');

    // Extract disease and country from title pattern "Disease - Country"
    const sep = title.indexOf(' - ');
    const disease = sep !== -1 ? title.slice(0, sep).trim() : title;
    const country = sep !== -1 ? title.slice(sep + 3).trim() : '';

    const lower = title.toLowerCase();
    const alertLevel = /outbreak|emergency|death/.test(lower) ? 'alert' as const
      : /update|additional/.test(lower) ? 'warning' as const : 'watch' as const;

    return {
      id: hashStr(`WHO-DON:${fullUrl || title}`),
      disease,
      country: country || 'Global',
      countryCode: '',
      alertLevel,
      title,
      summary: stripHtml(summary).slice(0, 300),
      url: fullUrl,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      source: 'WHO-DON',
    };
  });
}

async function handleOutbreaks(): Promise<unknown> {
  const cached = getCached<unknown>('outbreaks');
  if (cached) return cached;

  const sources = [
    { name: 'VnExpress', url: 'https://vnexpress.net/rss/suc-khoe.rss' },
    { name: 'VietnamNet', url: 'https://vietnamnet.vn/suc-khoe.rss' },
    { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
    { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
    { name: 'Dân Trí', url: 'https://dantri.com.vn/rss/suc-khoe.rss' },
  ];

  const results = await Promise.allSettled(sources.map(async (s) => {
    const xml = await fetchRss(s.url);
    const items = parseRssItems(xml);
    const outbreaks: unknown[] = [];
    for (const item of items) {
      const text = item.title + ' ' + item.description;
      const dm = matchDisease(text);
      if (!dm) continue;
      const prov = findProvince(text);
      outbreaks.push({
        id: hashStr(`${s.name}:${item.link}`),
        disease: dm.disease,
        country: 'Vietnam',
        countryCode: 'VN',
        alertLevel: refineAlert(text, dm.alert),
        title: item.title,
        summary: item.description,
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        lat: prov?.coords[0] ?? 16.05,
        lng: prov?.coords[1] ?? 108.22,
        province: prov?.name,
        source: s.name,
      });
    }
    return outbreaks;
  }));

  // Also fetch WHO DON API (structured global outbreak data)
  const whoDonResult = await Promise.allSettled([fetchWhoDon()]);

  const all: unknown[] = [];
  const okSources: string[] = [];

  // VN news sources
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      all.push(...(results[i] as PromiseFulfilledResult<unknown[]>).value);
      okSources.push(sources[i].name);
    }
  }

  // WHO DON
  if (whoDonResult[0].status === 'fulfilled') {
    all.push(...(whoDonResult[0] as PromiseFulfilledResult<unknown[]>).value);
    okSources.push('WHO-DON');
  }

  const seen = new Set<string>();
  const deduped = (all as Array<{ id: string; publishedAt: number }>)
    .filter(it => { if (seen.has(it.id)) return false; seen.add(it.id); return true; })
    .sort((a, b) => b.publishedAt - a.publishedAt);

  // Server-side LLM enrichment: crawl top articles → extract cases/district/ward
  // Runs during fetch, not background — data arrives already enriched
  await enrichTopArticles(deduped as unknown as OutbreakItem[]);

  const payload = { outbreaks: deduped, fetchedAt: Date.now(), sources: okSources };
  setCached('outbreaks', payload, 10 * 60_000);
  return payload;
}

// ---------------------------------------------------------------------------
// Stats handler — derives from outbreaks (same logic as Edge function)
// ---------------------------------------------------------------------------
async function handleStats(): Promise<unknown> {
  const cached = getCached<unknown>('stats');
  if (cached) return cached;

  const outbreaksPayload = await handleOutbreaks() as { outbreaks: Array<{ disease: string; countryCode: string; alertLevel: string }> };
  const outbreaks = outbreaksPayload.outbreaks;

  const diseaseCount = new Map<string, number>();
  const countries = new Set<string>();
  let activeAlerts = 0;

  for (const o of outbreaks) {
    diseaseCount.set(o.disease, (diseaseCount.get(o.disease) ?? 0) + 1);
    if (o.countryCode) countries.add(o.countryCode);
    if (o.alertLevel === 'alert') activeAlerts++;
  }

  const topDiseases = Array.from(diseaseCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([disease, count]) => ({ disease, count }));

  const stats = {
    totalOutbreaks: outbreaks.length,
    activeAlerts,
    countriesAffected: countries.size,
    topDiseases,
    lastUpdated: Date.now(),
  };

  const payload = { stats, fetchedAt: Date.now() };
  setCached('stats', payload, 30 * 60_000);
  return payload;
}

// ---------------------------------------------------------------------------
// Climate handler — fetches real Open-Meteo weather data for VN provinces
// ---------------------------------------------------------------------------
const CLIMATE_PROVINCES = [
  { name: 'TP. Hồ Chí Minh', lat: 10.82, lng: 106.63 },
  { name: 'Hà Nội',           lat: 21.03, lng: 105.85 },
  { name: 'Đà Nẵng',          lat: 16.05, lng: 108.22 },
  { name: 'Cần Thơ',          lat: 10.04, lng: 105.79 },
  { name: 'Hải Phòng',        lat: 20.86, lng: 106.68 },
  { name: 'Khánh Hòa',        lat: 12.25, lng: 109.05 },
  { name: 'Bình Dương',       lat: 11.17, lng: 106.65 },
  { name: 'Đồng Nai',         lat: 10.95, lng: 106.82 },
];

function dengueScore(tMax: number, rain: number, hum: number): number {
  const t = tMax >= 25 && tMax <= 35 ? 1 : tMax > 35 ? 0.7 : tMax >= 20 ? 0.3 : 0.1;
  const r = rain > 20 ? 1 : rain > 5 ? 0.7 : rain > 0 ? 0.3 : 0.05;
  const h = hum > 80 ? 1 : hum > 70 ? 0.7 : hum > 60 ? 0.4 : 0.1;
  return Math.min(1, t * 0.4 + r * 0.35 + h * 0.25);
}

function hfmdScore(tMax: number, hum: number): number {
  const t = tMax > 28 ? 1 : tMax > 24 ? 0.5 : 0.2;
  const h = hum > 80 ? 1 : hum > 70 ? 0.6 : hum > 60 ? 0.3 : 0.1;
  return Math.min(1, t * 0.5 + h * 0.5);
}

function riskLevel(score: number): string {
  if (score >= 0.6) return 'HIGH';
  if (score >= 0.3) return 'MODERATE';
  return 'LOW';
}

async function handleClimate(): Promise<unknown> {
  const cached = getCached<unknown>('climate');
  if (cached) return cached;

  const results = await Promise.allSettled(CLIMATE_PROVINCES.map(async (p) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean&forecast_days=14&timezone=Asia%2FBangkok`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json() as { daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; relative_humidity_2m_mean: number[] } };
    const d = data.daily;
    const avg = (arr: number[]) => arr.reduce((s, v) => s + (v ?? 0), 0) / arr.length;
    const tMax = +avg(d.temperature_2m_max).toFixed(1);
    const tMin = +avg(d.temperature_2m_min).toFixed(1);
    const rain = +avg(d.precipitation_sum).toFixed(1);
    const hum = +avg(d.relative_humidity_2m_mean).toFixed(1);
    const dr = +dengueScore(tMax, rain, hum).toFixed(2);
    const hr = +hfmdScore(tMax, hum).toFixed(2);

    let peakScore = -1, peakDay = d.time[0] ?? '';
    for (let i = 0; i < d.time.length; i++) {
      const s = dengueScore(d.temperature_2m_max[i]??0, d.precipitation_sum[i]??0, d.relative_humidity_2m_mean[i]??0);
      if (s > peakScore) { peakScore = s; peakDay = d.time[i] ?? ''; }
    }

    return {
      province: p.name, lat: p.lat, lng: p.lng,
      dengueRisk: dr, hfmdRisk: hr,
      dengueLevel: riskLevel(dr), hfmdLevel: riskLevel(hr),
      tempMax: tMax, tempMin: tMin, rainfall: rain, humidity: hum,
      forecastDays: d.time.length, peakRiskDay: peakDay,
    };
  }));

  const forecasts = results
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled')
    .map(r => r.value);

  const payload = { forecasts, fetchedAt: Date.now() };
  setCached('climate', payload, 6 * 60 * 60_000);
  return payload;
}

// ---------------------------------------------------------------------------
// Article content fetch — uses crawl4ai for JS-rendered sites, falls back to simple fetch
// ---------------------------------------------------------------------------
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

const CRAWL4AI_PYTHON = '/tmp/crawl4ai-env/bin/python3';
import { resolve as pathResolve } from 'node:path';
const CRAWL4AI_SCRIPT = pathResolve(process.cwd(), 'scripts/crawl-article.py');

/** Try crawl4ai first (handles JS-rendered pages), fall back to simple fetch */
async function handleArticle(articleUrl: string): Promise<unknown> {
  const cacheKey = `article:${articleUrl}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  let title = '';
  let body = '';

  // Strategy 1: crawl4ai (handles JS-rendered DanTri, VietnamNet etc.)
  try {
    const { stdout } = await execFileAsync(CRAWL4AI_PYTHON, [CRAWL4AI_SCRIPT, articleUrl], { timeout: 30000 });
    // Find JSON line in output (crawl4ai may emit logs before JSON)
    const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
    if (jsonLine) {
      const result = JSON.parse(jsonLine);
      body = result.body || '';
      title = result.title || '';
      // If crawl4ai got useful content, clean it
      if (body.length > 200 && !body.includes('KHÔNG TÌM THẤY')) {
        // Remove navigation noise common in Vietnamese news sites
        body = cleanArticleBody(body);
      } else {
        body = ''; // Trigger fallback
      }
    }
  } catch {
    // crawl4ai failed — try simple fetch
  }

  // Strategy 2: Simple fetch (works for SSR sites like VnExpress)
  if (!body || body.length < 100) {
    try {
      const res = await fetch(articleUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpidemicMonitor/1.0)' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      if (res.ok) {
        // Check final URL matches requested URL (detect redirects to unrelated pages)
        const finalUrl = res.url;
        const html = await res.text();

        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (!title) title = titleMatch ? stripHtml(titleMatch[1]) : '';

        // Extract article body using site-specific selectors
        const bodyPatterns = [
          /<article[^>]*>([\s\S]*?)<\/article>/i,
          /<div[^>]*class="[^"]*(?:fck_detail|article-body|content-detail|singular-content|detail-content|newsFeatureContent|the-article-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*(?:detail__content|main-content-body|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        ];

        let extracted = '';
        for (const p of bodyPatterns) {
          const m = html.match(p);
          if (m) { extracted = m[1] || m[0]; if (extracted.length > 200) break; }
        }

        if (extracted.length > 100) {
          body = extracted
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    } catch { /* Both strategies failed */ }
  }

  body = body.slice(0, 5000);
  const payload = { url: articleUrl, title, body, fetchedAt: Date.now() };
  setCached(cacheKey, payload, 60 * 60_000);
  return payload;
}

/** Remove navigation/menu noise from crawled article body */
function cleanArticleBody(body: string): string {
  // Split into lines, remove short lines that look like menu items
  const lines = body.split(/[.\n]/).map(l => l.trim()).filter(Boolean);
  const contentLines = lines.filter(l => {
    // Skip typical navigation patterns
    if (l.length < 20) return false;
    if (/^(Xem thêm|Tin mới|Mới nhất|Video|Thời sự|Kinh doanh|Giải trí|Xin chào|Đăng ký|Đăng nhập|Đặt báo)/i.test(l)) return false;
    if (/^(Cài đặt|Bình luận|Lịch sử|Dành cho bạn|Thoát)/i.test(l)) return false;
    return true;
  });
  return contentLines.join('. ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// YouTube transcript fetch — extract captions from video
// ---------------------------------------------------------------------------
async function handleYouTubeTranscript(videoId: string): Promise<unknown> {
  const cacheKey = `yt:${videoId}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'vi,en;q=0.9' },
    signal: AbortSignal.timeout(10000),
  });
  if (!pageRes.ok) throw new Error(`YouTube ${pageRes.status}`);
  const html = await pageRes.text();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : videoId;

  // Find caption tracks
  const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
  if (!captionMatch) return { videoId, title, transcript: null, error: 'No captions available' };

  let tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>;
  try { tracks = JSON.parse(captionMatch[1]); } catch { return { videoId, title, transcript: null, error: 'Parse error' }; }

  const viTrack = tracks.find(t => t.languageCode === 'vi' && t.kind !== 'asr')
    ?? tracks.find(t => t.languageCode === 'vi')
    ?? tracks.find(t => t.languageCode === 'en')
    ?? tracks[0];

  if (!viTrack?.baseUrl) return { videoId, title, transcript: null, error: 'No usable track' };

  const captionRes = await fetch(viTrack.baseUrl, { signal: AbortSignal.timeout(8000) });
  if (!captionRes.ok) throw new Error(`Caption fetch ${captionRes.status}`);
  const xml = await captionRes.text();

  const segments: Array<{ text: string; start: number }> = [];
  const segRe = /<text\s+start="([^"]+)"\s+dur="[^"]*"[^>]*>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = segRe.exec(xml)) !== null) {
    segments.push({ start: parseFloat(m[1]), text: stripHtml(m[2]) });
  }

  const fullText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, 10000);

  const payload = { videoId, title, language: viTrack.languageCode, segmentCount: segments.length, fullText, fetchedAt: Date.now() };
  setCached(cacheKey, payload, 6 * 60 * 60_000); // 6 hour cache
  return payload;
}

// ---------------------------------------------------------------------------
// Vite plugin
// ---------------------------------------------------------------------------
export function devApiMiddleware(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/health/v1/')) return next();

        const urlObj = new URL(req.url, 'http://localhost');
        const route = urlObj.pathname.replace('/api/health/v1/', '');
        try {
          let data: unknown;
          if (route === 'news') data = await handleNews();
          else if (route === 'outbreaks') data = await handleOutbreaks();
          else if (route === 'stats') data = await handleStats();
          else if (route === 'climate') data = await handleClimate();
          else if (route === 'article') {
            const articleUrl = urlObj.searchParams.get('url');
            if (!articleUrl) { res.statusCode = 400; res.end('{"error":"Missing url param"}'); return; }
            data = await handleArticle(articleUrl);
          }
          else if (route === 'youtube-transcript') {
            const vid = urlObj.searchParams.get('v');
            if (!vid) { res.statusCode = 400; res.end('{"error":"Missing v param"}'); return; }
            data = await handleYouTubeTranscript(vid);
          }
          else return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        } catch (err) {
          console.error(`[dev-api] ${route} error:`, err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

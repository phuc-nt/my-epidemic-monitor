/**
 * Health news aggregator API route.
 * Fetches 5 RSS feeds in parallel, merges and sorts by date, returns top 50.
 * Uses regex-based XML parsing for Edge Runtime compatibility (no DOMParser).
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'news';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const RSS_SOURCES: { name: string; url: string }[] = [
  // Vietnamese health news (primary — real articles with real URLs)
  { name: 'VnExpress', url: 'https://vnexpress.net/rss/suc-khoe.rss' },
  { name: 'VietnamNet', url: 'https://vietnamnet.vn/suc-khoe.rss' },
  { name: 'Tuổi Trẻ', url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
  { name: 'Dân Trí', url: 'https://dantri.com.vn/rss/suc-khoe.rss' },
  // International sources
  { name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml' },
  { name: 'CDC-EID', url: 'https://wwwnc.cdc.gov/eid/rss/upcoming.xml' },
  { name: 'ECDC', url: 'https://www.ecdc.europa.eu/en/rss.xml' },
  {
    name: 'ReliefWeb',
    url: 'https://api.reliefweb.int/v1/reports?appname=epidemic-monitor&filter[field]=theme.name&filter[value]=Health&format=rss',
  },
  // Vietnam-specific international sources
  { name: 'WHO-VN', url: 'https://www.who.int/vietnam/rss-feeds/news/rss.xml' },
];

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

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary: string;
}

function parseRssFeed(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(extractTag(block, 'title'));
    const url = extractLink(block);
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || extractTag(block, 'published');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'summary')).slice(0, 300);

    if (!title || !url) continue;

    items.push({
      id: hashString(`${sourceName}:${url || title}`),
      title,
      source: sourceName,
      url,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      summary: description,
    });
  }

  return items;
}

async function fetchFeed(source: { name: string; url: string }): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'EpidemicMonitor/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${source.name} RSS ${res.status}`);
  const xml = await res.text();
  return parseRssFeed(xml, source.name);
}

export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ items: unknown[]; fetchedAt: number; sources: string[] }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 900);

  try {
    const results = await Promise.allSettled(RSS_SOURCES.map(fetchFeed));

    const allItems: NewsItem[] = [];
    const successSources: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
        successSources.push(RSS_SOURCES[i].name);
      }
      // Failed sources are silently skipped — partial data is better than nothing
    }

    // Deduplicate by id, sort by date desc, limit 50
    const seen = new Set<string>();
    const items = allItems
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 50);

    const payload = { items, fetchedAt: Date.now(), sources: successSources };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 900);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch news');
  }
}

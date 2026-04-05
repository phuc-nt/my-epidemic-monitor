/**
 * Health news feed — Mac Mini pipeline as primary source.
 * Tries Mac Mini /news endpoint first; falls back to VN RSS feeds if unavailable.
 * Fallback ensures news panel still works when Mac Mini is offline.
 */
import { jsonResponse, errorResponse } from '../../_cors';
import { getCached, setCached } from '../../_cache';

export const config = { runtime: 'edge' };

const CACHE_KEY = 'news';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary?: string;
  imageUrl?: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Primary: Mac Mini /news endpoint
// Expected response: { items: NewsItem[], fetchedAt: number }
// ---------------------------------------------------------------------------
async function fetchPipelineNews(): Promise<NewsItem[]> {
  const apiUrl = process.env.EPIDEMIC_API_URL;
  const apiKey = process.env.EPIDEMIC_API_KEY;
  if (!apiUrl || !apiKey) throw new Error('EPIDEMIC_API_URL not configured');

  const res = await fetch(`${apiUrl}/news?limit=50`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Pipeline /news ${res.status}`);
  const data = await res.json() as { items: NewsItem[] };
  if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('Pipeline /news: empty response');
  return data.items;
}

// ---------------------------------------------------------------------------
// Fallback: VN RSS feeds (used when Mac Mini is offline)
// ---------------------------------------------------------------------------
const RSS_FALLBACK_SOURCES = [
  { name: 'VnExpress',   url: 'https://vnexpress.net/rss/suc-khoe.rss' },
  { name: 'Tuổi Trẻ',   url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
];

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractLink(block: string): string {
  const lm = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s);
  if (lm && lm[1].trim()) return lm[1].trim();
  const gm = block.match(/<guid[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/guid>/s);
  return gm ? gm[1].trim() : '';
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

function parseRssFeed(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, 'title').replace(/<[^>]+>/g, '').trim();
    const url = extractLink(block);
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const summary = extractTag(block, 'description').replace(/<[^>]+>/g, '').trim().slice(0, 300);
    if (!title || !url) continue;
    items.push({
      id: hashString(`${sourceName}:${url}`),
      title, source: sourceName, url,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      summary,
    });
  }
  return items;
}

async function fetchRssFallback(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FALLBACK_SOURCES.map(async s => {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': 'EpidemicMonitor/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${s.name} RSS ${res.status}`);
      return parseRssFeed(await res.text(), s.name);
    })
  );
  const all: NewsItem[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  return all;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function GET(_request: Request): Promise<Response> {
  const cached = getCached<{ items: unknown[]; fetchedAt: number; source: string }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 900);

  try {
    let items: NewsItem[];
    let source: string;

    try {
      items = await fetchPipelineNews();
      source = 'pipeline';
    } catch {
      // Mac Mini unavailable — use RSS fallback
      items = await fetchRssFallback();
      source = 'rss-fallback';
    }

    // Deduplicate + sort by date desc + limit 50
    const seen = new Set<string>();
    const deduped = items
      .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 50);

    const payload = { items: deduped, fetchedAt: Date.now(), source };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 900);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch news');
  }
}

/**
 * Health news endpoint — Cloudflare Pages Function.
 * Queries D1 outbreak_items table directly; falls back to VN RSS feeds if empty.
 * Replaces Vercel edge function that proxied to CF Worker via HTTP.
 */
import { jsonResponse, errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';

const CACHE_KEY = 'news';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const NEWS_LIMIT = 50;

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary?: string;
}

// ---------------------------------------------------------------------------
// Primary: D1 outbreak_items table
// ---------------------------------------------------------------------------
async function fetchNewsFromD1(db: D1Database): Promise<NewsItem[]> {
  const result = await db.prepare(`
    SELECT id, title,
      CASE WHEN instr(source, ':') > 0 THEN substr(source, instr(source, ':') + 1) ELSE source END AS source,
      url, COALESCE(published_at, ingested_at) AS published_at, summary
    FROM outbreak_items
    WHERE url IS NOT NULL AND title IS NOT NULL
    ORDER BY COALESCE(published_at, ingested_at) DESC
    LIMIT ?
  `).bind(NEWS_LIMIT).all<{ id: string; title: string; source: string; url: string; published_at: string; summary: string | null }>();

  return (result.results ?? []).map(row => ({
    id: String(row.id),
    title: String(row.title),
    source: String(row.source ?? ''),
    url: String(row.url),
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : Date.now(),
    summary: row.summary ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Fallback: VN RSS feeds (used when D1 returns empty)
// ---------------------------------------------------------------------------
const RSS_FALLBACK_SOURCES = [
  { name: 'VnExpress',   url: 'https://vnexpress.net/rss/suc-khoe.rss' },
  { name: 'Tuổi Trẻ',   url: 'https://tuoitre.vn/rss/suc-khoe.rss' },
  { name: 'Thanh Niên', url: 'https://thanhnien.vn/rss/suc-khoe.rss' },
  { name: 'Dân Trí',    url: 'https://dantri.com.vn/rss/suc-khoe.rss' },
  { name: 'VietnamNet',  url: 'https://vietnamnet.vn/suc-khoe.rss' },
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
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cached = getCached<{ items: unknown[]; fetchedAt: number; source: string }>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 900);

  try {
    let items: NewsItem[];
    let source: string;

    try {
      items = await fetchNewsFromD1(context.env.DB);
      if (items.length === 0) throw new Error('D1 outbreak_items: empty');
      source = 'pipeline';
    } catch {
      items = await fetchRssFallback();
      source = 'rss-fallback';
    }

    // Deduplicate + sort desc + limit
    const seen = new Set<string>();
    const deduped = items
      .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, NEWS_LIMIT);

    const payload = { items: deduped, fetchedAt: Date.now(), source };
    setCached(CACHE_KEY, payload, CACHE_TTL);
    return jsonResponse(payload, 200, 900);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch news');
  }
};

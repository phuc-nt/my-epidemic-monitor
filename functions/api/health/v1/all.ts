/**
 * Bulk data endpoint — returns outbreaks + stats + news in a single request.
 * Reduces 3 separate function invocations to 1, saving ~67% of CF Pages quota.
 * D1 queries for outbreaks and news run in parallel.
 *
 * Caching strategy (2 layers):
 * 1. Cloudflare edge cache via Cache API — shared across all users at a POP,
 *    5-min TTL. Serves from edge with 0 D1 reads and 0 function CPU after miss.
 * 2. In-memory function cache — per-instance fallback for warm Workers not
 *    covered by edge cache yet (cold-start scenarios).
 *
 * Also emits strong ETag for client-side If-None-Match → 304 (saves bandwidth
 * on repeat visits from the same user).
 */
import { errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';
import { fetchOutbreaksFromD1, type OutbreakItem } from '../../../_shared/outbreak-query';

const CACHE_KEY = 'all-data';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in-memory
const EDGE_CACHE_TTL_SEC = 300; // 5 minutes at CF edge
const NEWS_LIMIT = 50;

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: number;
  summary?: string;
}

/** Compute stats from outbreak items (no extra D1 query needed). */
function computeStats(outbreaks: OutbreakItem[]) {
  const diseaseCount = new Map<string, number>();
  const countries = new Set<string>();
  let activeAlerts = 0;

  for (const o of outbreaks) {
    diseaseCount.set(o.disease, (diseaseCount.get(o.disease) ?? 0) + 1);
    if (o.countryCode) countries.add(o.countryCode);
    if (o.alertLevel === 'alert') activeAlerts++;
  }

  return {
    totalOutbreaks: outbreaks.length,
    activeAlerts,
    countriesAffected: countries.size,
    topDiseases: Array.from(diseaseCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([disease, count]) => ({ disease, count })),
    lastUpdated: Date.now(),
  };
}

/** Fetch news from D1 outbreak_items table. */
async function fetchNews(db: D1Database): Promise<NewsItem[]> {
  const result = await db.prepare(`
    SELECT id, title,
      CASE WHEN instr(source, ':') > 0 THEN substr(source, instr(source, ':') + 1) ELSE source END AS source,
      url, COALESCE(published_at, ingested_at) AS published_at, summary
    FROM outbreak_items
    WHERE url IS NOT NULL AND title IS NOT NULL
    ORDER BY COALESCE(published_at, ingested_at) DESC
    LIMIT ?
  `).bind(NEWS_LIMIT).all<{ id: string; title: string; source: string; url: string; published_at: number; summary: string | null }>();

  return (result.results ?? []).map(r => ({
    id: String(r.id),
    title: String(r.title),
    source: String(r.source ?? ''),
    url: String(r.url),
    publishedAt: Number(r.published_at) || Date.now(),
    summary: r.summary ?? undefined,
  }));
}

/** Build the cacheable response with strong ETag + Cache-Control headers. */
function buildCachedResponse(payload: unknown): Response {
  const body = JSON.stringify(payload);
  // Strong ETag: FNV-1a 32-bit hash of body bytes. Cheap, deterministic,
  // collision-resistant enough for HTTP caching purposes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    hash = Math.imul(hash ^ body.charCodeAt(i), 0x01000193) >>> 0;
  }
  const etag = `"${hash.toString(16).padStart(8, '0')}-${body.length.toString(16)}"`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // s-maxage controls CF edge cache; max-age controls browser cache.
      // stale-while-revalidate lets edge serve stale for 10 min while refreshing.
      'Cache-Control': `public, max-age=60, s-maxage=${EDGE_CACHE_TTL_SEC}, stale-while-revalidate=600`,
      'ETag': etag,
      // Vary by Origin so auth/non-auth requests don't share cache entries.
      'Vary': 'Origin',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Layer 1: CF edge cache (Cache API) — shared across all users at a POP.
  // Cache key is URL-only; origin gating happens in _middleware.ts BEFORE
  // this handler, so only authorized requests can populate/read the cache.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  const edgeHit = await cache.match(cacheKey);
  if (edgeHit) {
    // Honor client If-None-Match → 304 for bandwidth savings.
    const ifNoneMatch = request.headers.get('If-None-Match');
    const etag = edgeHit.headers.get('ETag');
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, Vary: 'Origin' } });
    }
    return edgeHit;
  }

  // Layer 2: In-memory per-instance cache (covers cold-start race to populate edge).
  const cached = getCached<unknown>(CACHE_KEY);
  if (cached) {
    const resp = buildCachedResponse(cached);
    // Populate edge cache asynchronously so next request at this POP is a hit.
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  }

  try {
    // Parallel: outbreaks (7 D1 queries) + news (1 D1 query)
    const [outbreaks, newsItems] = await Promise.all([
      fetchOutbreaksFromD1(context.env.DB),
      fetchNews(context.env.DB),
    ]);

    const payload = {
      outbreaks,
      stats: computeStats(outbreaks),
      news: { items: newsItems, source: newsItems.length > 0 ? 'pipeline' : 'empty' },
      fetchedAt: Date.now(),
      sources: outbreaks.length > 0 ? ['pipeline'] : [],
    };

    setCached(CACHE_KEY, payload, CACHE_TTL);
    const resp = buildCachedResponse(payload);
    // Populate edge cache for subsequent requests.
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Bulk fetch failed');
  }
};

/**
 * Bulk data endpoint — returns outbreaks + stats + news in a single request.
 * Reduces 3 separate function invocations to 1, saving ~67% of CF Pages quota.
 * D1 queries for outbreaks and news run in parallel.
 */
import { jsonResponse, errorResponse } from '../../../_shared/cors';
import { getCached, setCached } from '../../../_shared/cache';
import { fetchOutbreaksFromD1, type OutbreakItem } from '../../../_shared/outbreak-query';

const CACHE_KEY = 'all-data';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cached = getCached<unknown>(CACHE_KEY);
  if (cached) return jsonResponse(cached, 200, 600);

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
    return jsonResponse(payload, 200, 600);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Bulk fetch failed');
  }
};

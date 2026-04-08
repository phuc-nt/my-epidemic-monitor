/**
 * Re-exports all client-side data services.
 */
export { fetchDiseaseOutbreaks } from '@/services/disease-outbreak-service';
export { fetchEpidemicStats } from '@/services/epidemic-stats-service';
export { fetchHealthNews } from '@/services/news-feed-service';
export { apiFetch } from '@/services/api-client';
export { cachedFetch, invalidateCache, clearCache } from '@/services/fetch-cache';

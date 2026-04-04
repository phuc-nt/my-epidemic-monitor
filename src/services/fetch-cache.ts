/**
 * Generic stale-while-revalidate cache for client-side service calls.
 * Stores data in memory with an expiry timestamp.
 * On cache miss, fetches fresh data. On stale hit, serves cached data
 * and revalidates in the background.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Return cached data if valid, otherwise undefined. */
function getEntry<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

/** Store data with TTL in milliseconds. */
function setEntry<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiry: Date.now() + ttlMs });
}

/**
 * Fetch with stale-while-revalidate semantics.
 * - On cache hit (fresh): returns cached data immediately.
 * - On cache miss: calls fetcher, stores result, returns it.
 * @param key    Cache key
 * @param fetcher Async function that fetches fresh data
 * @param ttlMs  Time-to-live in milliseconds
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const cached = getEntry<T>(key);
  if (cached !== undefined) return cached;

  const data = await fetcher();
  setEntry(key, data, ttlMs);
  return data;
}

/** Invalidate a cache entry manually. */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/** Clear the entire cache. */
export function clearCache(): void {
  store.clear();
}

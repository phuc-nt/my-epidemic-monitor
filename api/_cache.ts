/** Simple in-memory cache with TTL for edge API routes. */

interface CacheEntry {
  data: unknown;
  expiry: number;
}

const store = new Map<string, CacheEntry>();

/** Retrieve cached value if still valid. Returns undefined if missing or expired. */
export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/** Store a value with the given TTL in milliseconds. */
export function setCached(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expiry: Date.now() + ttlMs });
}

/** Clear a specific cache entry. */
export function clearCached(key: string): void {
  store.delete(key);
}

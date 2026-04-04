/** Prefix applied to all keys to avoid collisions with other apps. */
const PREFIX = 'epidemic-monitor-';

/**
 * Read a JSON value from localStorage.
 * Returns `fallback` on parse error or missing key.
 */
export function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persist a value as JSON in localStorage.
 * Silently swallows quota errors.
 */
export function setJSON(key: string, val: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(val));
  } catch {
    // Storage quota exceeded — ignore.
  }
}

/** Remove a key from localStorage. */
export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

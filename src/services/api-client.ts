/**
 * Thin HTTP client for calling /api/health/v1/* routes.
 * Adds timeout via AbortController and raises on non-2xx status.
 */

const API_BASE = '';

/**
 * Fetch a JSON endpoint with timeout.
 * Throws on network error, timeout, or non-2xx response.
 */
export async function apiFetch<T>(path: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

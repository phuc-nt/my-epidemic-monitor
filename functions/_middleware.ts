/**
 * Cloudflare Pages global middleware.
 * - Handles OPTIONS preflight
 * - Appends CORS headers to responses
 * - Simple in-memory rate limit for /api/chat (per-instance, best-effort)
 *
 * Note: For production-grade rate limiting, configure Cloudflare Rate Limiting Rules
 * in the dashboard. This middleware provides a code-level safety net only.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// In-memory rate limit buckets — per Worker instance (stateless across cold starts).
// Maps client IP → { count, resetAt }
interface Bucket { count: number; resetAt: number; }
const CHAT_LIMIT_PER_MIN = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitStore: Map<string, Bucket> = new Map();

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(clientIp);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: CHAT_LIMIT_PER_MIN - 1 };
  }

  if (bucket.count >= CHAT_LIMIT_PER_MIN) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count++;
  return { allowed: true, remaining: CHAT_LIMIT_PER_MIN - bucket.count };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Handle OPTIONS preflight immediately
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Rate limit /api/chat
  const url = new URL(request.url);
  if (url.pathname === '/api/chat' && request.method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { allowed, remaining } = checkRateLimit(clientIp);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in 1 minute.' }), {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(CHAT_LIMIT_PER_MIN),
          'X-RateLimit-Remaining': '0',
        },
      });
    }
    // Note: we can't easily inject headers into streaming response, so just log
    console.log(`[rate-limit] ${clientIp}: ${CHAT_LIMIT_PER_MIN - remaining}/${CHAT_LIMIT_PER_MIN}`);
  }

  try {
    const response = await context.next();
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};

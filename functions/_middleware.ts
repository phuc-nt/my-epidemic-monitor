/**
 * Cloudflare Pages global middleware.
 * - Same-origin restriction: only our own web UI can call /api/*
 * - Handles OPTIONS preflight
 * - Simple in-memory rate limit for /api/chat (per-instance, best-effort)
 *
 * Note: For production-grade rate limiting, configure Cloudflare Rate Limiting Rules
 * in the dashboard. This middleware provides a code-level safety net only.
 */

// Whitelist of allowed origins for /api/* endpoints
const ALLOWED_ORIGINS = [
  'https://epidemic-monitor.pages.dev',
  'http://localhost:5173',  // Vite dev
  'http://localhost:8788',  // wrangler pages dev
];

/** Dynamic CORS headers based on request origin. */
function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/** Check if request originates from an allowed web origin. */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin') ?? '';
  const referer = request.headers.get('Referer') ?? '';
  // Origin header present: strict match
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  // No Origin header (same-origin GET): fall back to Referer prefix match
  return ALLOWED_ORIGINS.some(a => referer.startsWith(a));
}

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
  const url = new URL(request.url);
  const corsHeaders = buildCorsHeaders(request.headers.get('Origin'));

  // Handle OPTIONS preflight immediately
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Origin gate — only web UI can call /api/*
  if (url.pathname.startsWith('/api/') && !isAllowedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden: origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Rate limit /api/chat
  if (url.pathname === '/api/chat' && request.method === 'POST') {
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { allowed, remaining } = checkRateLimit(clientIp);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in 1 minute.' }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(CHAT_LIMIT_PER_MIN),
          'X-RateLimit-Remaining': '0',
        },
      });
    }
    console.log(`[rate-limit] ${clientIp}: ${CHAT_LIMIT_PER_MIN - remaining}/${CHAT_LIMIT_PER_MIN}`);
  }

  try {
    const response = await context.next();
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

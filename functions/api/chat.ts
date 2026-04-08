/**
 * Chat proxy endpoint — secure server-side LLM gateway.
 * Keeps OPENROUTER_API_KEY on the server; browser never sees it.
 *
 * Security layers:
 * 1. Origin check (same-origin only, via Referer header)
 * 2. Rate limiting via Cloudflare Rate Limiting (configured at platform level)
 * 3. Input length + message count caps
 * 4. Hard-coded model — user cannot inject arbitrary models
 *
 * Request:  POST { messages: [{role, content}, ...] }
 * Response: text/event-stream (SSE) forwarding OpenRouter chunks
 */
import { corsHeaders } from '../_shared/cors';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'minimax/minimax-m2.7';
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000; // single message
const MAX_TOTAL_LENGTH = 20000; // sum across all messages
const DAILY_LIMIT_PER_IP = 10;  // max chat requests per IP per day

interface Env {
  OPENROUTER_API_KEY: string;
  DB: D1Database;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function errorSSE(message: string, status = 400): Response {
  const body = `data: ${JSON.stringify({ error: message })}\n\n`;
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Check + increment daily chat counter for an IP in D1.
 * Returns { allowed, used, limit, resetAt } — resetAt is unix ms.
 * Uses a simple upsert into chat_daily_limit table keyed by (ip, day).
 */
async function checkDailyLimit(db: D1Database, ip: string): Promise<{
  allowed: boolean; used: number; limit: number;
}> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // Ensure table exists (idempotent — runs once per cold start)
  await db.exec(
    'CREATE TABLE IF NOT EXISTS chat_daily_limit (ip TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, day))'
  );

  // Read current count
  const row = await db.prepare(
    'SELECT count FROM chat_daily_limit WHERE ip = ? AND day = ?'
  ).bind(ip, day).first<{ count: number }>();

  const currentCount = row?.count ?? 0;

  if (currentCount >= DAILY_LIMIT_PER_IP) {
    return { allowed: false, used: currentCount, limit: DAILY_LIMIT_PER_IP };
  }

  // Increment (upsert)
  await db.prepare(
    'INSERT INTO chat_daily_limit (ip, day, count) VALUES (?, ?, 1) ' +
    'ON CONFLICT(ip, day) DO UPDATE SET count = count + 1'
  ).bind(ip, day).run();

  return { allowed: true, used: currentCount + 1, limit: DAILY_LIMIT_PER_IP };
}

/** Validate request origin — reject cross-origin abuse. */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin') ?? '';
  const referer = request.headers.get('Referer') ?? '';
  const allowed = [
    'https://epidemic-monitor.pages.dev',
    'http://localhost:5173',  // Vite dev server
    'http://localhost:8788',  // wrangler pages dev
  ];
  return allowed.some(a => origin === a || referer.startsWith(a));
}

/** Sanitize + validate messages array. */
function validateMessages(raw: unknown): ChatMessage[] | string {
  if (!Array.isArray(raw)) return 'messages must be an array';
  if (raw.length === 0) return 'messages array is empty';
  if (raw.length > MAX_MESSAGES) return `too many messages (max ${MAX_MESSAGES})`;

  let totalLen = 0;
  const result: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return 'invalid message';
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') return 'invalid role';
    if (typeof content !== 'string') return 'content must be string';
    if (content.length > MAX_CONTENT_LENGTH) return `message too long (max ${MAX_CONTENT_LENGTH})`;
    totalLen += content.length;
    result.push({ role, content });
  }
  if (totalLen > MAX_TOTAL_LENGTH) return `total content too long (max ${MAX_TOTAL_LENGTH})`;
  return result;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // 1. Origin check
  if (!isAllowedOrigin(request)) {
    return errorSSE('Forbidden: origin not allowed', 403);
  }

  // 2. Env check
  if (!env.OPENROUTER_API_KEY) {
    return errorSSE('Server not configured: missing OPENROUTER_API_KEY', 500);
  }

  // 3. Parse + validate body
  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorSSE('Invalid JSON body', 400);
  }

  const messagesOrError = validateMessages(body.messages);
  if (typeof messagesOrError === 'string') {
    return errorSSE(messagesOrError, 400);
  }

  // 4. Daily per-IP limit (persistent via D1)
  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  try {
    const quota = await checkDailyLimit(env.DB, clientIp);
    if (!quota.allowed) {
      return new Response(
        `data: ${JSON.stringify({
          error: `Bạn đã dùng hết ${quota.limit} lượt chat cho hôm nay. Vui lòng quay lại vào ngày mai.`,
          used: quota.used,
          limit: quota.limit,
        })}\n\n`,
        {
          status: 429,
          headers: {
            ...corsHeaders(),
            'Content-Type': 'text/event-stream',
            'X-Chat-Limit': String(quota.limit),
            'X-Chat-Used': String(quota.used),
          },
        },
      );
    }
  } catch (err) {
    console.error('[chat-limit] check failed:', err);
    // On D1 error, fail open (don't block users) — middleware rate limit still applies
  }

  // 5. Forward to OpenRouter with server-side key
  const orRes = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://epidemic-monitor.pages.dev',
      'X-Title': 'Epidemic Monitor',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messagesOrError,
      stream: true,
    }),
  });

  if (!orRes.ok) {
    const errText = await orRes.text();
    return errorSSE(`OpenRouter error ${orRes.status}: ${errText.slice(0, 200)}`, 502);
  }

  // 5. Stream response back to client
  return new Response(orRes.body, {
    status: 200,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};

// Handle OPTIONS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

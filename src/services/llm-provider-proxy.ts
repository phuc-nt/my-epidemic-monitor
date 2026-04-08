/**
 * Proxy LLM provider — uses server-side /api/chat endpoint.
 * The API key stays on the Cloudflare Pages server; browser never sees it.
 * Always available (no user configuration needed).
 */

import type { LLMProvider, LLMProviderConfig, ChatMessage } from '@/types/llm-types';
import { readSSEStream } from '@/services/llm-sse-stream-reader';

const CHAT_URL = '/api/chat';

export function createProxyProvider(): LLMProvider {
  const config: LLMProviderConfig = {
    type: 'proxy',
    name: 'Cloud (MiniMax M2.7)',
    baseUrl: CHAT_URL,
    model: 'minimax/minimax-m2.7',
    apiKey: '', // key is server-side
    available: false,
  };

  return {
    config,

    async ping(): Promise<boolean> {
      try {
        // Quick health check — send OPTIONS or a tiny probe
        const res = await fetch(CHAT_URL, {
          method: 'OPTIONS',
          signal: AbortSignal.timeout(3000),
        });
        config.available = res.ok || res.status === 204;
        return config.available;
      } catch {
        config.available = false;
        return false;
      }
    },

    async listModels(): Promise<string[]> {
      return ['minimax/minimax-m2.7'];
    },

    async chat(
      messages: ChatMessage[],
      onChunk: (text: string) => void,
      onDone: () => void,
    ): Promise<void> {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (res.status === 429) {
        // Daily or rate limit hit — parse SSE error payload
        const raw = await res.text();
        const match = raw.match(/data:\s*({[^\n]+})/);
        let msg = 'Rate limit exceeded. Please try again later.';
        if (match) {
          try { msg = JSON.parse(match[1]).error ?? msg; } catch { /* ignore */ }
        }
        onChunk(msg);
        onDone();
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Chat proxy ${res.status}: ${errText.slice(0, 200)}`);
      }
      await readSSEStream(res, onChunk, onDone);
    },

    async complete(messages: ChatMessage[]): Promise<string> {
      // Proxy endpoint only supports streaming; buffer chunks.
      let full = '';
      await new Promise<void>((resolve, reject) => {
        fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        })
          .then(res => {
            if (!res.ok) return reject(new Error(`Chat proxy ${res.status}`));
            return readSSEStream(res, (chunk) => { full += chunk; }, () => resolve());
          })
          .catch(reject);
      });
      return full;
    },
  };
}

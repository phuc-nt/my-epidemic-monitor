/**
 * OpenRouter provider adapter — default for web users.
 * Base URL: https://openrouter.ai/api/v1
 * Default model: minimax/minimax-m1-80k
 * Requires an API key stored in localStorage via settings.
 */

import type { LLMProvider, LLMProviderConfig, ChatMessage } from '@/types/llm-types';
import { readSSEStream } from '@/services/llm-sse-stream-reader';

const BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'minimax/minimax-m1-80k';

/** Curated model list — avoids fetching 200+ models from the API. */
const CURATED_MODELS = [
  'minimax/minimax-m1-80k',
  'google/gemma-3-4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

export function createOpenRouterProvider(apiKey: string, model?: string): LLMProvider {
  const config: LLMProviderConfig = {
    type: 'openrouter',
    name: 'OpenRouter',
    baseUrl: BASE_URL,
    model: model || DEFAULT_MODEL,
    apiKey,
    available: false,
  };

  function authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Epidemic Monitor',
    };
  }

  return {
    config,

    async ping(): Promise<boolean> {
      try {
        const res = await fetch(`${BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        config.available = res.ok;
        return res.ok;
      } catch {
        config.available = false;
        return false;
      }
    },

    async listModels(): Promise<string[]> {
      return CURATED_MODELS;
    },

    async chat(
      messages: ChatMessage[],
      onChunk: (text: string) => void,
      onDone: () => void,
    ): Promise<void> {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: config.model, messages, stream: true }),
      });
      await readSSEStream(res, onChunk, onDone);
    },

    async complete(messages: ChatMessage[]): Promise<string> {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: config.model, messages, stream: false }),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}

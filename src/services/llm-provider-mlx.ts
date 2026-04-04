/**
 * MLX provider adapter — Apple Silicon local inference server (mlx-lm).
 * Base URL: http://localhost:8080/v1 (OpenAI-compatible)
 * No API key required.
 * Default model: auto-detected from running server via /v1/models.
 */

import type { LLMProvider, LLMProviderConfig, ChatMessage } from '@/types/llm-types';
import { readSSEStream } from '@/services/llm-sse-stream-reader';

const BASE_URL = 'http://localhost:8080/v1';

interface OpenAIModelsResponse {
  data?: { id: string }[];
}

export function createMlxProvider(model?: string): LLMProvider {
  const config: LLMProviderConfig = {
    type: 'mlx',
    name: 'MLX (local)',
    baseUrl: BASE_URL,
    model: model || '',
    available: false,
  };

  return {
    config,

    async ping(): Promise<boolean> {
      try {
        const res = await fetch(`${BASE_URL}/models`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok && !config.model) {
          // Auto-detect the running model on first successful ping
          const json = await res.json() as OpenAIModelsResponse;
          config.model = json.data?.[0]?.id ?? '';
        }
        config.available = res.ok;
        return res.ok;
      } catch {
        config.available = false;
        return false;
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const res = await fetch(`${BASE_URL}/models`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];
        const json = await res.json() as OpenAIModelsResponse;
        return (json.data ?? []).map((m) => m.id);
      } catch {
        return [];
      }
    },

    async chat(
      messages: ChatMessage[],
      onChunk: (text: string) => void,
      onDone: () => void,
    ): Promise<void> {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages, stream: true }),
      });
      await readSSEStream(res, onChunk, onDone);
    },

    async complete(messages: ChatMessage[]): Promise<string> {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages, stream: false }),
      });
      if (!res.ok) throw new Error(`MLX ${res.status}: ${await res.text()}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}

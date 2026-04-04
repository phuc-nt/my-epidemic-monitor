/**
 * Ollama provider adapter — local inference server.
 * Base URL: http://localhost:11434/v1 (OpenAI-compatible)
 * Default model: gemma3:4b
 * No API key required.
 *
 * ping() and listModels() use the native Ollama /api/tags endpoint
 * so they work even if the OpenAI-compat layer has quirks.
 */

import type { LLMProvider, LLMProviderConfig, ChatMessage } from '@/types/llm-types';
import { readSSEStream } from '@/services/llm-sse-stream-reader';

const BASE_URL = 'http://localhost:11434/v1';
const TAGS_URL = 'http://localhost:11434/api/tags';
const DEFAULT_MODEL = 'gemma3:4b';

interface OllamaTagsResponse {
  models?: { name: string }[];
}

export function createOllamaProvider(model?: string): LLMProvider {
  const config: LLMProviderConfig = {
    type: 'ollama',
    name: 'Ollama (local)',
    baseUrl: BASE_URL,
    model: model || DEFAULT_MODEL,
    available: false,
  };

  return {
    config,

    async ping(): Promise<boolean> {
      try {
        const res = await fetch(TAGS_URL, {
          signal: AbortSignal.timeout(3000),
        });
        config.available = res.ok;
        return res.ok;
      } catch {
        config.available = false;
        return false;
      }
    },

    async listModels(): Promise<string[]> {
      try {
        const res = await fetch(TAGS_URL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return [];
        const json = await res.json() as OllamaTagsResponse;
        return (json.models ?? []).map((m) => m.name);
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
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? '';
    },
  };
}

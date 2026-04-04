/**
 * Shared SSE stream reader for OpenAI-compatible /v1/chat/completions responses.
 * Used by all LLM provider adapters (OpenRouter, Ollama, MLX).
 */

import type { ChatCompletionChunk } from '@/types/llm-types';

/**
 * Reads a Server-Sent Events stream from a fetch Response and extracts
 * text deltas from OpenAI-compatible chat completion chunks.
 *
 * @throws Error if the response status is not ok.
 */
export async function readSSEStream(
  res: Response,
  onChunk: (text: string) => void,
  onDone: () => void,
): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${body}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onDone();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {
          // Skip malformed or non-JSON SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
}

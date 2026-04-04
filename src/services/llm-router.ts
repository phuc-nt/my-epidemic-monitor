/**
 * LLM router — central entry point for all AI operations.
 *
 * Responsibilities:
 * - initLLM(): ping all 3 providers, set first available as active
 * - getActiveProvider() / getProviders(): inspect current state
 * - setActiveProvider(type): switch provider, persist choice
 * - chat() / complete(): convenience wrappers that route to active provider
 * - onProviderChange(): subscribe to provider switch events
 */

import { getJSON, setJSON } from '@/utils/storage';
import { emit, on, off } from '@/app/app-context';
import type { LLMProvider, LLMProviderType, ChatMessage } from '@/types/llm-types';
import { createOpenRouterProvider } from '@/services/llm-provider-openrouter';
import { createOllamaProvider } from '@/services/llm-provider-ollama';
import { createMlxProvider } from '@/services/llm-provider-mlx';

const EVENT_PROVIDER_CHANGE = 'llm:provider-change';

let _activeProvider: LLMProvider | null = null;
let _providers: LLMProvider[] = [];

/**
 * Initialise the LLM subsystem.
 * Pings all configured providers in parallel and selects the active one.
 * Respects the user's saved provider preference when available.
 * Returns the active provider, or null if none is reachable.
 */
export async function initLLM(): Promise<LLMProvider | null> {
  const candidates: LLMProvider[] = [];

  // Build candidate list
  const orKey = getJSON<string>('openrouter-api-key', '');
  if (orKey) {
    const orModel = getJSON<string>('openrouter-model', 'minimax/minimax-m1-80k');
    candidates.push(createOpenRouterProvider(orKey, orModel));
  }
  candidates.push(createOllamaProvider());
  candidates.push(createMlxProvider());

  // Ping all providers in parallel
  const results = await Promise.allSettled(candidates.map((p) => p.ping()));
  _providers = candidates.filter((_, i) => {
    const r = results[i];
    return r.status === 'fulfilled' && r.value === true;
  });

  // Restore saved provider preference, fall back to first available
  const savedType = getJSON<string>('llm-provider', '');
  _activeProvider =
    _providers.find((p) => p.config.type === savedType) ?? _providers[0] ?? null;

  return _activeProvider;
}

/** Return the currently active provider, or null if none initialised. */
export function getActiveProvider(): LLMProvider | null {
  return _activeProvider;
}

/** Return all providers that responded to ping during last initLLM(). */
export function getProviders(): LLMProvider[] {
  return _providers;
}

/**
 * Switch the active provider by type.
 * Persists the choice to localStorage and emits 'llm:provider-change'.
 * No-op if the requested type is not in the available provider list.
 */
export function setActiveProvider(type: LLMProviderType): void {
  const found = _providers.find((p) => p.config.type === type);
  if (!found) return;
  _activeProvider = found;
  setJSON('llm-provider', type);
  emit(EVENT_PROVIDER_CHANGE);
}

/**
 * Subscribe to provider change events.
 * Returns an unsubscribe function for cleanup.
 */
export function onProviderChange(handler: () => void): () => void {
  const wrapped = () => handler();
  on(EVENT_PROVIDER_CHANGE, wrapped);
  return () => off(EVENT_PROVIDER_CHANGE, wrapped);
}

/**
 * Stream a chat completion to the active provider.
 * @throws Error if no provider is available.
 */
export async function chat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
): Promise<void> {
  if (!_activeProvider) throw new Error('No LLM provider available');
  return _activeProvider.chat(messages, onChunk, onDone);
}

/**
 * Non-streaming chat completion via the active provider.
 * Returns empty string if no provider is available (safe for UI use).
 */
export async function complete(messages: ChatMessage[]): Promise<string> {
  if (!_activeProvider) return '';
  return _activeProvider.complete(messages);
}

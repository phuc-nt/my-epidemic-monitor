/** LLM provider types and interfaces for the epidemic monitor AI chatbox. */

export type LLMProviderType = 'openrouter' | 'ollama' | 'mlx';

export interface LLMProviderConfig {
  type: LLMProviderType;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  available: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionChunk {
  choices: { delta: { content?: string }; finish_reason?: string }[];
}

export interface LLMProvider {
  config: LLMProviderConfig;
  /** Check if this provider is reachable. */
  ping(): Promise<boolean>;
  /** List available models. */
  listModels(): Promise<string[]>;
  /** Send chat completion — streams tokens via onChunk, calls onDone when finished. */
  chat(messages: ChatMessage[], onChunk: (text: string) => void, onDone: () => void): Promise<void>;
  /** Send chat completion — non-streaming, returns full response text. */
  complete(messages: ChatMessage[]): Promise<string>;
}

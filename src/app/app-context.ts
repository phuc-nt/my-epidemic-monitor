import type { DiseaseOutbreakItem, NewsItem, CountryHealthProfile } from '@/types';

export interface EpidemicAppContext {
  /** MapShell instance — set during initApp(). */
  map: unknown;
  /** Panel instances keyed by panel id. */
  panels: Map<string, unknown>;
  outbreaks: DiseaseOutbreakItem[];
  news: NewsItem[];
  countryProfiles: Map<string, CountryHealthProfile>;
  isMobile: boolean;
}

/** Singleton app context shared across modules. */
export const ctx: EpidemicAppContext = {
  map: null,
  panels: new Map(),
  outbreaks: [],
  news: [],
  countryProfiles: new Map(),
  isMobile: window.innerWidth < 768,
};

// ---------------------------------------------------------------------------
// Simple event bus
// ---------------------------------------------------------------------------

type EventHandler = (data: unknown) => void;
const _handlers = new Map<string, Set<EventHandler>>();

/** Register an event listener. */
export function on(event: string, handler: EventHandler): void {
  if (!_handlers.has(event)) _handlers.set(event, new Set());
  _handlers.get(event)!.add(handler);
}

/** Emit an event to all registered listeners. */
export function emit(event: string, data?: unknown): void {
  _handlers.get(event)?.forEach(h => h(data));
}

/** Remove a previously registered listener. */
export function off(event: string, handler: EventHandler): void {
  _handlers.get(event)?.delete(handler);
}

import { getJSON, setJSON, removeKey } from '@/utils/storage';

/** localStorage key for row span values (keyed by panel id). */
const SPANS_KEY = 'panel-spans';

/** localStorage key for collapsed state (keyed by panel id). */
const COLLAPSED_KEY = 'panel-collapsed';

// ---------------------------------------------------------------------------
// Row span persistence
// ---------------------------------------------------------------------------

export function loadPanelSpans(): Record<string, number> {
  return getJSON<Record<string, number>>(SPANS_KEY, {});
}

export function savePanelSpan(panelId: string, span: number): void {
  const spans = loadPanelSpans();
  spans[panelId] = span;
  setJSON(SPANS_KEY, spans);
}

export function getPanelSpan(panelId: string, defaultSpan = 1): number {
  return loadPanelSpans()[panelId] ?? defaultSpan;
}

export function clearPanelSpan(panelId: string): void {
  const spans = loadPanelSpans();
  if (!(panelId in spans)) return;
  delete spans[panelId];
  if (Object.keys(spans).length === 0) {
    removeKey(SPANS_KEY);
  } else {
    setJSON(SPANS_KEY, spans);
  }
}

// ---------------------------------------------------------------------------
// Collapsed state persistence
// ---------------------------------------------------------------------------

export function loadPanelCollapsed(): Record<string, boolean> {
  return getJSON<Record<string, boolean>>(COLLAPSED_KEY, {});
}

export function savePanelCollapsed(panelId: string, collapsed: boolean): void {
  const map = loadPanelCollapsed();
  if (collapsed) {
    map[panelId] = true;
  } else {
    delete map[panelId];
  }
  if (Object.keys(map).length === 0) {
    removeKey(COLLAPSED_KEY);
  } else {
    setJSON(COLLAPSED_KEY, map);
  }
}

export function isPanelCollapsed(panelId: string): boolean {
  return loadPanelCollapsed()[panelId] === true;
}

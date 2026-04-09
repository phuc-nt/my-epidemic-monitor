import { h } from '@/utils/dom-utils';

/**
 * Creates the top-level app layout:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │            global header                    │  ← appHeader
 *   ├──────────────────┬──────────────────────────┤
 *   │   map-container  │      panels-grid         │  ← appShell
 *   └──────────────────┴──────────────────────────┘
 *
 * The global header holds brand identity, disclaimer, author credit,
 * and legal links in one consolidated place — keeps the map and the
 * dashboard clean of chrome.
 */
export interface AppLayout {
  appHeader: HTMLElement;
  appShell: HTMLElement;
  mapContainer: HTMLElement;
  panelsGrid: HTMLElement;
}

export function createLayout(): AppLayout {
  const app = document.getElementById('app');
  if (!app) throw new Error('createLayout: #app element not found');

  const appHeader   = h('div', { className: 'app-header' });
  const mapContainer = h('div', { id: 'map', className: 'map-container' });
  const panelsGrid   = h('div', { className: 'panels-grid' });

  const appShell = h('div', { className: 'app-shell' }, mapContainer, panelsGrid);
  const root     = h('div', { className: 'app-root' }, appHeader, appShell);

  app.appendChild(root);

  return { appHeader, appShell, mapContainer, panelsGrid };
}

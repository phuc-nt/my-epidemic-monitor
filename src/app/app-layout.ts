import { h } from '@/utils/dom-utils';

/**
 * Creates the top-level CSS grid layout and mounts it into #app.
 * Returns references to the map container and panels grid.
 *
 * Desktop: map (left 60%) | panels grid (right 40%)
 * Mobile (<768px): stacked vertically, map on top
 */
export interface AppLayout {
  mapContainer: HTMLElement;
  panelsGrid: HTMLElement;
}

export function createLayout(): AppLayout {
  const app = document.getElementById('app');
  if (!app) throw new Error('createLayout: #app element not found');

  const mapContainer = h('div', { id: 'map', className: 'map-container' });

  const panelsGrid = h('div', { className: 'panels-grid' });

  const shell = h('div', { className: 'app-shell' }, mapContainer, panelsGrid);

  app.appendChild(shell);

  return { mapContainer, panelsGrid };
}

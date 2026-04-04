/**
 * Map Layer Controls
 * Floating card mounted inside the map container (top-left).
 * Layer toggles + time filter for outbreaks.
 */

import { h } from '@/utils/dom-utils';
import { toggleLayer, getLayerVisibility } from '@/components/map-layers/index';
import { emit } from '@/app/app-context';
import type { LayerName } from '@/components/map-layers/index';

interface ControlDef {
  name: LayerName;
  label: string;
}

const CONTROLS: ControlDef[] = [
  { name: 'markers',    label: 'Outbreak Markers' },
  { name: 'heatmap',    label: 'Severity Heatmap' },
  { name: 'choropleth', label: 'Country Risk'     },
];

const TIME_FILTERS = [
  { label: '24h', ms: 24 * 3600_000 },
  { label: '7d',  ms: 7 * 24 * 3600_000 },
  { label: '30d', ms: 30 * 24 * 3600_000 },
  { label: 'All', ms: 0 },
];

export class MapLayerControls {
  private _el: HTMLElement;
  private _activeTimeFilter = 0; // 0 = show all

  constructor(mapContainer: HTMLElement) {
    this._el = this._build();
    mapContainer.appendChild(this._el);
  }

  destroy(): void {
    this._el.parentElement?.removeChild(this._el);
  }

  private _build(): HTMLElement {
    const visibility = getLayerVisibility();

    const title = h('p', { className: 'layer-controls-title' }, 'Map Layers');
    const card  = h('div', { className: 'layer-controls-card' }, title);

    for (const def of CONTROLS) {
      card.appendChild(this._buildRow(def, visibility[def.name]));
    }

    // Time filter section
    const timeTitle = h('p', { className: 'layer-controls-title', style: 'margin-top:8px' }, 'Time Filter');
    card.appendChild(timeTitle);

    const timeBar = h('div', { className: 'time-filter-bar' });
    for (const tf of TIME_FILTERS) {
      const btn = h('button', {
        className: `time-filter-btn${tf.ms === 0 ? ' time-filter-btn--active' : ''}`,
        dataset: { ms: String(tf.ms) },
      }, tf.label);

      btn.addEventListener('click', () => {
        this._activeTimeFilter = tf.ms;
        // Update active state
        for (const b of timeBar.querySelectorAll('.time-filter-btn')) {
          b.classList.toggle('time-filter-btn--active', b === btn);
        }
        // Emit event for app-init to filter outbreaks by time
        emit('time-filter-changed', tf.ms);
      });

      timeBar.appendChild(btn);
    }
    card.appendChild(timeBar);

    return card;
  }

  private _buildRow(def: ControlDef, initialChecked: boolean): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.id      = `layer-toggle-${def.name}`;
    checkbox.checked = initialChecked;
    checkbox.className = 'layer-controls-checkbox';

    checkbox.addEventListener('change', () => {
      toggleLayer(def.name);
    });

    const label = h('label', {
      className: 'layer-controls-label',
    }, checkbox, def.label);
    label.setAttribute('for', `layer-toggle-${def.name}`);

    return h('div', { className: 'layer-controls-row' }, label);
  }
}

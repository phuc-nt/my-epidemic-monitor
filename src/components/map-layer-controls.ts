/**
 * Map Layer Controls
 * Floating dark card mounted inside the map container (top-left).
 * Three checkboxes control outbreak markers, heatmap, and country risk choropleth.
 */

import { h } from '@/utils/dom-utils';
import { toggleLayer, getLayerVisibility } from '@/components/map-layers/index';
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

export class MapLayerControls {
  private _el: HTMLElement;

  constructor(mapContainer: HTMLElement) {
    this._el = this._build();
    mapContainer.appendChild(this._el);
  }

  /** Remove from DOM. */
  destroy(): void {
    if (this._el.parentElement) {
      this._el.parentElement.removeChild(this._el);
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _build(): HTMLElement {
    const visibility = getLayerVisibility();

    const title = h('p', { className: 'layer-controls-title' }, 'Map Layers');
    const card  = h('div', { className: 'layer-controls-card' }, title);

    for (const def of CONTROLS) {
      card.appendChild(this._buildRow(def, visibility[def.name]));
    }

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
      // 'for' is a reserved word — set via setAttribute
    }, checkbox, def.label);
    label.setAttribute('for', `layer-toggle-${def.name}`);

    return h('div', { className: 'layer-controls-row' }, label);
  }
}

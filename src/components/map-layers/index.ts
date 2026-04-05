/**
 * Map Layers — orchestration module.
 * Maintains layer visibility state and rebuilds the deck.gl layer stack
 * whenever toggleLayer() is called or data changes.
 */

import type { Layer } from '@deck.gl/core';
import type { MapShell } from '@/components/map-shell';
import type { DiseaseOutbreakItem } from '@/types';
import { createOutbreakMarkersLayer } from './outbreak-markers-layer';
import { createSeverityHeatmapLayer } from './severity-heatmap-layer';
import { createCountryChoroplethLayer } from './country-choropleth-layer';
import { createEarlyWarningLayer } from './early-warning-layer';
import { createDistrictChoroplethLayer } from './district-choropleth-layer';
import type { EarlyWarning } from '@/services/trend-calculator';

export type LayerName = 'markers' | 'heatmap' | 'choropleth' | 'earlyWarnings' | 'districts';

export interface LayerCallbacks {
  onMarkerClick?: (item: DiseaseOutbreakItem) => void;
  onCountryClick?: (countryCode: string) => void;
}

/** Visibility state for all named layers. */
const _visible: Record<LayerName, boolean> = {
  markers:       true,
  heatmap:       true,
  choropleth:    true,
  earlyWarnings: true,
  districts:     true,
};

/** Last known inputs — stored so toggleLayer() can rebuild without re-passing. */
let _shell: MapShell | null = null;
let _outbreaks: DiseaseOutbreakItem[] = [];
let _riskScores: Map<string, number> = new Map();
let _geoJson: unknown = null;
let _callbacks: LayerCallbacks = {};
let _earlyWarnings: EarlyWarning[] = [];
let _districtGeoJson: unknown = null;
let _highlightedProvince: string | null = null;

/**
 * Rebuild and push the active layer stack to the map.
 * Call this whenever data or visibility changes.
 */
export function updateMapLayers(
  shell: MapShell,
  outbreaks: DiseaseOutbreakItem[],
  riskScores: Map<string, number>,
  geoJson: unknown,
  callbacks: LayerCallbacks,
): void {
  // Persist so toggleLayer() can re-render without arguments.
  _shell     = shell;
  _outbreaks = outbreaks;
  _riskScores = riskScores;
  _geoJson   = geoJson;
  _callbacks = callbacks;

  _applyLayers();
}

/**
 * Toggle a named layer on/off and immediately re-render.
 * No-op if updateMapLayers() has never been called.
 */
export function toggleLayer(name: LayerName): void {
  _visible[name] = !_visible[name];
  if (_shell) _applyLayers();
}

/** Set district GeoJSON boundaries and re-render. */
export function setDistrictGeoJson(geoJson: unknown): void {
  _districtGeoJson = geoJson;
  if (_shell) _applyLayers();
}

/** Set early warning data and re-render layers. */
export function setEarlyWarnings(warnings: EarlyWarning[]): void {
  _earlyWarnings = warnings;
  if (_shell) _applyLayers();
}

/** Highlight markers for a specific province — dims all others. Pass null to clear. */
export function setHighlightedProvince(province: string | null): void {
  _highlightedProvince = province;
  if (_shell) _applyLayers();
}

/** Return current visibility state (copy). */
export function getLayerVisibility(): Record<LayerName, boolean> {
  return { ..._visible };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _applyLayers(): void {
  if (!_shell) return;

  const layers: Layer[] = [];

  // District boundaries first (below other layers)
  if (_visible.districts && _districtGeoJson) {
    layers.push(createDistrictChoroplethLayer(_districtGeoJson, _outbreaks));
  }

  if (_visible.choropleth && _geoJson) {
    layers.push(createCountryChoroplethLayer(_geoJson, _riskScores, _callbacks.onCountryClick));
  }

  if (_visible.heatmap) {
    layers.push(createSeverityHeatmapLayer(_outbreaks));
  }

  if (_visible.markers) {
    layers.push(createOutbreakMarkersLayer(_outbreaks, _callbacks.onMarkerClick, _highlightedProvince));
  }

  if (_visible.earlyWarnings && _earlyWarnings.length > 0) {
    layers.push(createEarlyWarningLayer(_earlyWarnings));
  }

  _shell.setLayers(layers);
}

// Re-export individual layer factories for direct use.
export { createOutbreakMarkersLayer } from './outbreak-markers-layer';
export { createSeverityHeatmapLayer } from './severity-heatmap-layer';
export { createCountryChoroplethLayer } from './country-choropleth-layer';

import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';

/**
 * Light, clean basemap — optimized for data readability over aesthetics.
 * OpenFreeMap bright = vector tiles, free, no key.
 * CartoDB positron = light fallback, clean labels.
 */
const BASEMAP_PRIMARY = 'https://tiles.openfreemap.org/styles/bright';
const BASEMAP_FALLBACK = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/** Default center: Vietnam [lng, lat] */
const DEFAULT_CENTER: [number, number] = [107.5, 15.5];
const DEFAULT_ZOOM = 6;

/**
 * Thin wrapper around a MapLibre GL map with a deck.gl overlay.
 * Mount to #map container. Call setLayers() to update deck.gl layers.
 */
export class MapShell {
  private map: maplibregl.Map;
  private overlay: MapboxOverlay;

  constructor(containerId = 'map') {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`MapShell: container #${containerId} not found in DOM`);
    }

    this.map = new maplibregl.Map({
      container,
      style: BASEMAP_PRIMARY,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: 14,
      maxBounds: [[95.0, 5.0], [118.0, 26.0]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    // Fallback to CartoDB if primary basemap fails to load
    this.map.on('error', (e) => {
      const msg = String(e?.error?.message ?? '');
      if (msg.includes('404') || msg.includes('Failed')) {
        console.warn('[MapShell] Primary basemap failed, switching to fallback');
        this.map.setStyle(BASEMAP_FALLBACK);
      }
    });

    // Localize map labels to Vietnamese perspective whenever the style (re)loads
    this.map.on('style.load', () => this._applyVietnameseLabelOverrides());

    // Minimal attribution in bottom-right
    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    // Navigation controls (zoom +/-)
    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // deck.gl overlay — starts with no layers
    this.overlay = new MapboxOverlay({ layers: [] });
    this.map.addControl(this.overlay as unknown as maplibregl.IControl);
  }

  /**
   * Replace the current deck.gl layer stack.
   * Safe to call before the map fires 'load'.
   */
  setLayers(layers: Layer[]): void {
    this.overlay.setProps({ layers });
  }

  /** Fly to a location. */
  flyTo(center: [number, number], zoom?: number): void {
    this.map.flyTo({ center, zoom: zoom ?? this.map.getZoom() });
  }

  /** Tell MapLibre to recompute canvas size — needed after the map
   *  container changes dimensions (e.g., mobile tab switch from hidden
   *  back to visible). Safe to call repeatedly. */
  resize(): void {
    this.map.resize();
  }

  /** Expose the underlying MapLibre map for advanced use. */
  getMap(): maplibregl.Map {
    return this.map;
  }

  /** Clean up map resources. */
  destroy(): void {
    this.map.remove();
  }

  /**
   * Replace politically sensitive sea labels ("South China Sea") with the
   * Vietnamese name "Biển Đông", and add Hoàng Sa / Trường Sa archipelago
   * labels that the upstream basemap omits.
   */
  private _applyVietnameseLabelOverrides(): void {
    const style = this.map.getStyle();
    if (!style?.layers) return;

    // 1) Rewrite text on any water/marine label layer that currently shows
    //    "South China Sea". Covers common OpenMapTiles / CartoDB patterns.
    const waterLabelPatterns = /water|marine|ocean|place[-_]sea/i;
    for (const layer of style.layers) {
      if (layer.type !== 'symbol') continue;
      if (!waterLabelPatterns.test(layer.id)) continue;
      try {
        this.map.setLayoutProperty(layer.id, 'text-field', [
          'let',
          'raw',
          ['coalesce', ['get', 'name:vi'], ['get', 'name:en'], ['get', 'name']],
          [
            'case',
            ['==', ['var', 'raw'], 'South China Sea'], 'Biển Đông',
            ['==', ['var', 'raw'], 'Nam Hải'], 'Biển Đông',
            ['var', 'raw'],
          ],
        ]);
      } catch {
        // Layer may not support text-field expression — ignore and continue
      }
    }

    // 2) Inject Hoàng Sa & Trường Sa labels (absent from OpenFreeMap bright).
    const SOURCE_ID = 'vn-sea-labels';
    const LAYER_ID  = 'vn-sea-labels-text';
    if (!this.map.getSource(SOURCE_ID)) {
      this.map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Biển Đông', size: 18 },
              geometry: { type: 'Point', coordinates: [112.5, 15.0] },
            },
            {
              type: 'Feature',
              properties: { name: 'Quần đảo Hoàng Sa\n(Việt Nam)', size: 12 },
              geometry: { type: 'Point', coordinates: [112.0, 16.5] },
            },
            {
              type: 'Feature',
              properties: { name: 'Quần đảo Trường Sa\n(Việt Nam)', size: 12 },
              geometry: { type: 'Point', coordinates: [114.0, 10.0] },
            },
          ],
        },
      });
    }
    if (!this.map.getLayer(LAYER_ID)) {
      this.map.addLayer({
        id: LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['get', 'size'],
          'text-font': ['Noto Sans Regular'],
          'text-letter-spacing': 0.05,
          'text-max-width': 10,
          'text-anchor': 'center',
        },
        paint: {
          'text-color': '#1e3a5f',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 1.5,
        },
      });
    }
  }
}

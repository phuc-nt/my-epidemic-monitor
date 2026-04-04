import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer } from '@deck.gl/core';

/**
 * High-resolution dark vector basemap options (ordered by quality):
 * 1. OpenFreeMap — free, no key, full vector tiles with retina support
 * 2. CartoDB dark-matter-gl — fallback if OpenFreeMap is down
 */
const BASEMAP_PRIMARY = 'https://tiles.openfreemap.org/styles/dark';
const BASEMAP_FALLBACK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

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
      minZoom: 5,
      maxZoom: 14,
      maxBounds: [[100.0, 7.5], [114.0, 24.0]],
      pixelRatio: window.devicePixelRatio || 2,
      attributionControl: false,
    });

    // Fallback to CartoDB if primary basemap fails to load
    this.map.on('error', (e) => {
      if (e.error?.message?.includes('404') || e.error?.message?.includes('Failed')) {
        console.warn('[MapShell] Primary basemap failed, switching to fallback');
        this.map.setStyle(BASEMAP_FALLBACK);
      }
    });

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

  /** Expose the underlying MapLibre map for advanced use. */
  getMap(): maplibregl.Map {
    return this.map;
  }

  /** Clean up map resources. */
  destroy(): void {
    this.map.remove();
  }
}

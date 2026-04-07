/**
 * Outbreak Markers Layer
 * Renders color-coded scatter plot circles for each geolocated outbreak.
 * Color and radius are driven by alertLevel.
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';

/** Fully opaque colors for light basemap visibility */
const ALERT_COLORS: Record<AlertLevel, [number, number, number, number]> = {
  alert:   [220,  38,  38, 220],
  warning: [217, 119,   6, 200],
  watch:   [163, 163,  18, 180],
};

/** Radius in meters — large enough for Vietnam zoom */
const ALERT_RADII: Record<AlertLevel, number> = {
  alert:   25_000,
  warning: 18_000,
  watch:   12_000,
};

/** Extract YYYY-MM-DD from a UTC timestamp. */
function dayOf(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

/**
 * Build a ScatterplotLayer for geolocated outbreaks.
 * Items without lat/lng are silently excluded.
 * @param highlightedProvince - non-matching markers are dimmed
 * @param selectedDate - YYYY-MM-DD; markers from other days rendered gray + smaller
 */
export function createOutbreakMarkersLayer(
  outbreaks: DiseaseOutbreakItem[],
  onClick?: (item: DiseaseOutbreakItem) => void,
  highlightedProvince?: string | null,
  selectedDate?: string | null,
): ScatterplotLayer<DiseaseOutbreakItem> {
  // Exclude "Toàn quốc" / unlocated items — they have no meaningful map position
  const data = outbreaks.filter(o =>
    o.lat != null && o.lng != null &&
    o.province !== 'Toàn quốc' && o.province !== 'phía Nam' && o.province !== 'ĐBSCL'
  );

  return new ScatterplotLayer<DiseaseOutbreakItem>({
    id: 'outbreak-markers',
    data,
    getPosition: (d) => [d.lng!, d.lat!],
    getRadius: (d) => {
      const base = ALERT_RADII[d.alertLevel] ?? 10;
      const isToday = selectedDate && dayOf(d.publishedAt) === selectedDate;
      // Today's items: full size (or enlarged if province highlighted)
      if (isToday) {
        if (highlightedProvince && d.province === highlightedProvince) return base * 1.3;
        return base;
      }
      // Past days: slightly smaller but still visible
      return base * 0.7;
    },
    getFillColor: (d) => {
      const color = ALERT_COLORS[d.alertLevel] ?? [150, 150, 150, 150];
      const isToday = selectedDate && dayOf(d.publishedAt) === selectedDate;
      // Province dimming
      if (highlightedProvince && d.province !== highlightedProvince) {
        return [color[0], color[1], color[2], 60];
      }
      // Today: full color, past days: softer opacity
      if (isToday) return color;
      return [color[0], color[1], color[2], Math.round(color[3] * 0.5)];
    },
    pickable: true,
    onClick: (info) => {
      if (info.object && onClick) onClick(info.object);
    },
    radiusMinPixels: 5,
    radiusMaxPixels: 40,
    stroked: true,
    getLineColor: (d) => {
      const isToday = selectedDate && dayOf(d.publishedAt) === selectedDate;
      if (highlightedProvince && d.province === highlightedProvince) return [255, 255, 255, 200];
      if (isToday) return [0, 0, 0, 40];
      return [0, 0, 0, 20]; // past days: lighter stroke
    },
    lineWidthMinPixels: 1,
    updateTriggers: {
      getFillColor:  [highlightedProvince, selectedDate],
      getRadius:     [highlightedProvince, selectedDate],
      getLineColor:  [highlightedProvince, selectedDate],
    },
  });
}

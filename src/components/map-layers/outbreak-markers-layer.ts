/**
 * Outbreak Markers Layer
 * Renders color-coded scatter plot circles for each geolocated outbreak.
 * Color and radius are driven by alertLevel.
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';

const ALERT_COLORS: Record<AlertLevel, [number, number, number, number]> = {
  alert:   [231,  76,  60, 200],
  warning: [230, 126,  34, 180],
  watch:   [241, 196,  15, 160],
};

/** Radius in meters — large enough for Vietnam zoom */
const ALERT_RADII: Record<AlertLevel, number> = {
  alert:   25_000,
  warning: 18_000,
  watch:   12_000,
};

/**
 * Build a ScatterplotLayer for geolocated outbreaks.
 * Items without lat/lng are silently excluded.
 */
export function createOutbreakMarkersLayer(
  outbreaks: DiseaseOutbreakItem[],
  onClick?: (item: DiseaseOutbreakItem) => void,
): ScatterplotLayer<DiseaseOutbreakItem> {
  const data = outbreaks.filter(o => o.lat != null && o.lng != null);

  return new ScatterplotLayer<DiseaseOutbreakItem>({
    id: 'outbreak-markers',
    data,
    getPosition: (d) => [d.lng!, d.lat!],
    getRadius:   (d) => ALERT_RADII[d.alertLevel]  ?? 10,
    getFillColor:(d) => ALERT_COLORS[d.alertLevel] ?? [150, 150, 150, 150],
    pickable: true,
    onClick: (info) => {
      if (info.object && onClick) onClick(info.object);
    },
    radiusMinPixels: 8,
    radiusMaxPixels: 40,
    stroked: true,
    getLineColor: [255, 255, 255, 60],
    lineWidthMinPixels: 1,
  });
}

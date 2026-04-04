/**
 * Severity Heatmap Layer
 * Renders a density heatmap weighted by outbreak alert severity.
 * Uses @deck.gl/aggregation-layers HeatmapLayer (bundled with deck.gl v9).
 */

import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { DiseaseOutbreakItem, AlertLevel } from '@/types';

const WEIGHT_MAP: Record<AlertLevel, number> = {
  alert:   3,
  warning: 2,
  watch:   1,
};

/** Five-stop color ramp from cool (low density) to hot (high density). */
const COLOR_RANGE: [number, number, number][] = [
  [255, 255, 178],
  [254, 204,  92],
  [253, 141,  60],
  [240,  59,  32],
  [189,   0,  38],
];

/**
 * Build a HeatmapLayer weighted by alert severity.
 * Items without lat/lng are silently excluded.
 */
export function createSeverityHeatmapLayer(
  outbreaks: DiseaseOutbreakItem[],
): HeatmapLayer<DiseaseOutbreakItem> {
  const data = outbreaks.filter(o => o.lat != null && o.lng != null);

  return new HeatmapLayer<DiseaseOutbreakItem>({
    id: 'severity-heatmap',
    data,
    getPosition: (d) => [d.lng!, d.lat!],
    getWeight:   (d) => WEIGHT_MAP[d.alertLevel] ?? 1,
    radiusPixels: 50,
    intensity: 0.8,
    threshold: 0.15,
    opacity: 0.6,
    colorRange: COLOR_RANGE,
  });
}

/**
 * Early Warning Layer — pulsing markers for provinces with HIGH climate risk
 * but NO active outbreak. Alerts health workers to prepare.
 */
import { ScatterplotLayer } from '@deck.gl/layers';
import type { EarlyWarning } from '@/services/trend-calculator';

/**
 * Build a ScatterplotLayer for early warning provinces.
 * Uses pulsing yellow-orange markers distinct from outbreak markers.
 */
export function createEarlyWarningLayer(
  warnings: EarlyWarning[],
  onClick?: (w: EarlyWarning) => void,
): ScatterplotLayer<EarlyWarning> {
  return new ScatterplotLayer<EarlyWarning>({
    id: 'early-warnings',
    data: warnings,
    getPosition: (d) => [d.lng, d.lat],
    getRadius: 20000,
    getFillColor: [255, 193, 7, 140],   // amber/yellow — distinct from red outbreak markers
    getLineColor: [255, 152, 0, 200],   // orange border
    pickable: true,
    stroked: true,
    lineWidthMinPixels: 2,
    radiusMinPixels: 10,
    radiusMaxPixels: 25,
    onClick: (info) => {
      if (info.object && onClick) onClick(info.object);
    },
  });
}

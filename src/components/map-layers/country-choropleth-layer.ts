/**
 * Country Choropleth Layer
 * Colors country polygons by risk score [0..1] using GeoJsonLayer.
 * Requires GeoJSON country boundaries (not included — caller provides).
 */

import { GeoJsonLayer } from '@deck.gl/layers';

/** Map a 0..1 risk score to an RGBA fill color. */
function riskColor(score: number): [number, number, number, number] {
  if (score < 0.33) return [46,  204, 113, 120]; // green  — low
  if (score < 0.66) return [241, 196,  15, 140]; // yellow — moderate
  return               [231,  76,  60, 160]; // red    — high
}

/**
 * Build a GeoJsonLayer coloring countries by risk score.
 *
 * @param geoJson    - GeoJSON FeatureCollection of country polygons.
 *                     Expected property keys: ISO_A2 or iso_a2.
 * @param riskScores - Map from ISO-3166 alpha-2 code → risk score [0..1].
 * @param onClick    - Optional callback receiving the ISO-A2 code on click.
 */
export function createCountryChoroplethLayer(
  geoJson: unknown,
  riskScores: Map<string, number>,
  onClick?: (countryCode: string) => void,
): GeoJsonLayer {
  return new GeoJsonLayer({
    id: 'country-choropleth',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: geoJson as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFillColor: (f: any) => {
      const code: string = f.properties?.ISO_A2 ?? f.properties?.iso_a2 ?? '';
      const score = riskScores.get(code) ?? 0;
      return riskColor(score);
    },
    getLineColor: [100, 100, 100, 80],
    lineWidthMinPixels: 1,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 40],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: (info: any) => {
      const code: string =
        info.object?.properties?.ISO_A2 ?? info.object?.properties?.iso_a2 ?? '';
      if (code && onClick) onClick(code);
    },
  });
}

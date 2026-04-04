/**
 * District Choropleth Layer — fills Vietnam district boundaries
 * with color based on outbreak severity in each district.
 * Uses geoBoundaries VNM ADM2 GeoJSON (708 districts).
 */
import { GeoJsonLayer } from '@deck.gl/layers';
import type { DiseaseOutbreakItem } from '@/types';

/** Build a lookup: district name (lowercase) → max alert score */
function buildDistrictScores(outbreaks: DiseaseOutbreakItem[]): Map<string, number> {
  const scores = new Map<string, number>();
  const LEVEL_SCORE: Record<string, number> = { alert: 1.0, warning: 0.6, watch: 0.3 };

  for (const o of outbreaks) {
    if (!o.district) continue;
    const key = o.district.toLowerCase().replace(/^(quận|huyện|tp\.|thành phố)\s*/i, '').trim();
    const score = LEVEL_SCORE[o.alertLevel] ?? 0.2;
    const prev = scores.get(key) ?? 0;
    if (score > prev) scores.set(key, score);
  }
  return scores;
}

/** Interpolate score 0-1 → rgba color */
function scoreToColor(score: number): [number, number, number, number] {
  if (score >= 0.8) return [220, 38, 38, 140];     // red — alert
  if (score >= 0.5) return [217, 119, 6, 120];      // orange — warning
  if (score > 0)    return [234, 179, 8, 100];      // yellow — watch
  return [0, 0, 0, 0];                               // transparent — no data
}

/**
 * Create a GeoJsonLayer that fills district boundaries by outbreak severity.
 * Districts without outbreaks are transparent.
 */
export function createDistrictChoroplethLayer(
  geoJson: unknown,
  outbreaks: DiseaseOutbreakItem[],
  onClick?: (districtName: string) => void,
): GeoJsonLayer {
  const scores = buildDistrictScores(outbreaks);

  return new GeoJsonLayer({
    id: 'district-choropleth',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: geoJson as any,
    getFillColor: (f: { properties?: { shapeName?: string } }) => {
      const name = (f.properties?.shapeName ?? '').toLowerCase();
      // Try direct match, then fuzzy (remove diacritics not needed — shapeName is ASCII)
      const score = scores.get(name) ?? 0;
      return scoreToColor(score);
    },
    getLineColor: [100, 100, 100, 40],
    lineWidthMinPixels: 0.5,
    pickable: true,
    autoHighlight: true,
    highlightColor: [37, 99, 235, 60],
    onClick: (info) => {
      const name = info.object?.properties?.shapeName;
      if (name && onClick) onClick(name);
    },
  });
}

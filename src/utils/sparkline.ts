/**
 * Minimal SVG sparkline renderer.
 * No external dependencies — pure string interpolation.
 */

/**
 * Render a simple SVG polyline chart from numeric data.
 * Returns empty string if data is empty.
 */
export function renderSVGLine(
  data: number[],
  width = 300,
  height = 80,
  color = '#e74c3c',
): string {
  if (!data.length) return '';

  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height * 0.9).toFixed(1)}`)
    .join(' ');

  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;

  return (
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"` +
    ` style="width:100%;height:${height}px;display:block">` +
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>` +
    `<text x="2" y="${height - 4}" font-size="10" fill="#888">${first}</text>` +
    `<text x="${width - 2}" y="${height - 4}" font-size="10" fill="#888" text-anchor="end">${last}</text>` +
    `</svg>`
  );
}

/**
 * Render a mini area chart (filled below the line).
 */
export function renderSVGArea(
  data: number[],
  width = 300,
  height = 80,
  color = '#e74c3c',
): string {
  if (!data.length) return '';

  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const linePoints = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height * 0.85).toFixed(1)}`)
    .join(' ');

  // Close the area back along the bottom
  const first = `0,${height}`;
  const lastX = ((data.length - 1) * step).toFixed(1);
  const closePath = `${lastX},${height}`;
  const areaPoints = `${first} ${linePoints} ${closePath}`;

  return (
    `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"` +
    ` style="width:100%;height:${height}px;display:block">` +
    `<polygon points="${areaPoints}" fill="${color}" fill-opacity="0.15"/>` +
    `<polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

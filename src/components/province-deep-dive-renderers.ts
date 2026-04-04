/**
 * Province Deep Dive — DOM section builders.
 * Separated from the panel class to keep each file under 200 lines.
 */
import { h } from '@/utils/dom-utils';
import { emit } from '@/app/app-context';
import type { ClimateForecast, RiskLevel } from '@/services/climate-service';
import type { DiseaseOutbreakItem, NewsItem } from '@/types';

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

export function alertDot(level: DiseaseOutbreakItem['alertLevel']): string {
  switch (level) {
    case 'alert':   return '🔴';
    case 'warning': return '🟡';
    case 'watch':   return '🟢';
  }
}

export function riskDot(level: RiskLevel): string {
  switch (level) {
    case 'HIGH':     return '🔴';
    case 'MODERATE': return '🟡';
    case 'LOW':      return '🟢';
  }
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case 'HIGH':     return 'HIGH';
    case 'MODERATE': return 'MOD';
    case 'LOW':      return 'LOW';
  }
}

// ---------------------------------------------------------------------------
// Province name matching utilities
// ---------------------------------------------------------------------------

/** Strip diacritics, lowercase, collapse whitespace. */
export function normalizeProvince(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Return true if two province names refer to the same location. */
export function provincesMatch(a: string, b: string): boolean {
  const na = normalizeProvince(a);
  const nb = normalizeProvince(b);
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

export function buildOutbreaksSection(outbreaks: DiseaseOutbreakItem[]): HTMLElement {
  const section = h('div', { className: 'province-section' });
  section.appendChild(
    h('p', { className: 'province-section-title' }, `Active Outbreaks (${outbreaks.length})`),
  );

  if (outbreaks.length === 0) {
    section.appendChild(
      h('div', { style: 'font-size:12px;color:var(--text-muted)' }, 'No outbreaks recorded'),
    );
    return section;
  }

  for (const ob of outbreaks) {
    const dot = alertDot(ob.alertLevel);
    const shortDisease = ob.disease.split('(')[0]?.trim() ?? ob.disease;
    const label = ob.district ? `${shortDisease} — ${ob.district}` : shortDisease;
    const casesStr = ob.cases != null ? `${ob.cases.toLocaleString()} ca` : '';

    const row = h('div', { className: 'province-outbreak-row' },
      h('span', { className: 'province-outbreak-label' }, `${dot} ${label}`),
      h('span', { className: 'province-outbreak-cases' }, casesStr),
    );
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => emit('outbreak-selected', ob));
    section.appendChild(row);
  }

  return section;
}

export function buildClimateSection(fc: ClimateForecast): HTMLElement {
  const section = h('div', { className: 'province-section' });
  section.appendChild(h('p', { className: 'province-section-title' }, 'Climate Risk'));

  section.appendChild(
    h('div', { className: 'province-climate-row' },
      h('span', { className: 'province-climate-label' }, 'Dengue:'),
      h('span', {}, `${riskDot(fc.dengueLevel)} ${riskLabel(fc.dengueLevel)} (${fc.dengueRisk.toFixed(2)})`),
    ),
  );

  section.appendChild(
    h('div', { className: 'province-climate-row' },
      h('span', { className: 'province-climate-label' }, 'HFMD:'),
      h('span', {}, `${riskDot(fc.hfmdLevel)} ${riskLabel(fc.hfmdLevel)} (${fc.hfmdRisk.toFixed(2)})`),
    ),
  );

  section.appendChild(
    h('div', { className: 'province-climate-meta' },
      h('span', {}, `Temp: ${fc.tempMax}°C`),
      h('span', {}, `Rain: ${fc.rainfall}mm`),
      h('span', {}, `Humidity: ${fc.humidity}%`),
    ),
  );

  return section;
}

export function buildNewsSection(news: NewsItem[]): HTMLElement {
  const section = h('div', { className: 'province-section' });
  section.appendChild(
    h('p', { className: 'province-section-title' }, `Recent News (${news.length})`),
  );

  for (const item of news) {
    const label = item.source ? `${item.source}: ${item.title}` : item.title;
    const el = h('div', { className: 'province-news-item' }, `• ${label}`);
    el.title = item.title;
    if (item.url) {
      el.addEventListener('click', () => window.open(item.url, '_blank', 'noopener'));
    }
    section.appendChild(el);
  }

  return section;
}

export function buildTotals(outbreaks: DiseaseOutbreakItem[]): HTMLElement {
  const totalCases  = outbreaks.reduce((s, ob) => s + (ob.cases  ?? 0), 0);
  const totalDeaths = outbreaks.reduce((s, ob) => s + (ob.deaths ?? 0), 0);
  return h('div', { className: 'province-totals' },
    `Total: ${totalCases.toLocaleString()} cases, ${totalDeaths} deaths`,
  );
}

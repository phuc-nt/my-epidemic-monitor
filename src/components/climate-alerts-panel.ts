/**
 * Climate Predictive Alerts Panel.
 * Displays 14-day dengue/HFMD risk forecasts for 8 Vietnam provinces
 * derived from Open-Meteo weather data.
 * Clicking a province row emits 'province-selected' so the map can fly there.
 */
import '@/styles/climate.css';
import { Panel } from '@/components/panel-base';
import { fetchClimateForecasts } from '@/services/climate-service';
import type { ClimateForecast, RiskLevel } from '@/services/climate-service';
import { emit } from '@/app/app-context';
import { h } from '@/utils/dom-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dot indicator mapping risk level to emoji. */
function riskDot(level: RiskLevel): string {
  if (level === 'HIGH')     return '🔴';
  if (level === 'MODERATE') return '🟡';
  return '🟢';
}

/** CSS class suffix for a risk badge element. */
function badgeClass(level: RiskLevel): string {
  if (level === 'HIGH')     return 'climate-badge--high';
  if (level === 'MODERATE') return 'climate-badge--moderate';
  return 'climate-badge--low';
}

/** Compact label for badge text. */
function badgeLabel(level: RiskLevel): string {
  if (level === 'HIGH')     return 'HIGH';
  if (level === 'MODERATE') return 'MOD';
  return 'LOW';
}

function risklBadge(level: RiskLevel): HTMLElement {
  return h('span', { className: `climate-badge ${badgeClass(level)}` }, badgeLabel(level));
}

/** Format date string yyyy-mm-dd → dd/MM */
function shortDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

// ---------------------------------------------------------------------------
// Build alert banner
// ---------------------------------------------------------------------------

function buildAlertBanner(forecasts: ClimateForecast[]): HTMLElement | null {
  const highDengue = forecasts.filter((f) => f.dengueLevel === 'HIGH');
  if (highDengue.length === 0) return null;

  const provinceNames = highDengue.map((f) => f.province).join(', ');

  // Earliest peak risk day among high-risk provinces
  const peakDays = highDengue.map((f) => f.peakRiskDay).sort();
  const peakLabel = peakDays.length > 0 ? shortDate(peakDays[0] ?? '') : '';

  const banner = h('div', { className: 'climate-alert-banner' },
    h('span', { className: 'climate-alert-icon' }, '⚠'),
    h('div', { className: 'climate-alert-body' },
      h('span', { className: 'climate-alert-title' },
        `CẢNH BÁO: Nguy cơ SXH CAO — ${highDengue.length} tỉnh`,
      ),
      h('span', { className: 'climate-alert-provinces' }, provinceNames),
      peakLabel
        ? h('span', { className: 'climate-alert-peak' }, `Đỉnh dịch dự kiến: ${peakLabel}`)
        : false,
    ),
  );
  return banner;
}

// ---------------------------------------------------------------------------
// Build province table
// ---------------------------------------------------------------------------

function buildTable(
  forecasts: ClimateForecast[],
  onRowClick: (f: ClimateForecast) => void,
): HTMLElement {
  // Sort by dengue risk descending
  const sorted = [...forecasts].sort((a, b) => b.dengueRisk - a.dengueRisk);

  const thead = h('thead', null,
    h('tr', null,
      h('th', { className: 'climate-th' }, 'Tỉnh / Thành'),
      h('th', { className: 'climate-th' }, 'SXH'),
      h('th', { className: 'climate-th' }, 'HFMD'),
      h('th', { className: 'climate-th' }, 'T°max'),
      h('th', { className: 'climate-th' }, 'Mưa'),
    ),
  );

  const tbody = h('tbody', null);
  for (const f of sorted) {
    const dot = riskDot(f.dengueLevel);

    const row = h('tr', { className: 'climate-row' },
      h('td', { className: 'climate-td' },
        h('div', { className: 'climate-province-cell' },
          document.createTextNode(dot + ' '),
          document.createTextNode(f.province),
        ),
      ),
      h('td', { className: 'climate-td' }, risklBadge(f.dengueLevel)),
      h('td', { className: 'climate-td' }, risklBadge(f.hfmdLevel)),
      h('td', { className: 'climate-td' }, `${f.tempMax}°C`),
      h('td', { className: 'climate-td' }, `${f.rainfall}mm`),
    );

    row.addEventListener('click', () => onRowClick(f));
    tbody.appendChild(row);
  }

  return h('div', { className: 'climate-table-wrapper' },
    h('table', { className: 'climate-table' }, thead, tbody),
  );
}

// ---------------------------------------------------------------------------
// Panel class
// ---------------------------------------------------------------------------

export class ClimateAlertsPanel extends Panel {
  private _forecasts: ClimateForecast[] = [];

  constructor() {
    super({ id: 'climate-alerts', title: 'Climate Risk Forecast (14 days)', showCount: true, defaultRowSpan: 3 });
    this.showLoading();
    void this._loadData();
  }

  /** Accept pre-fetched forecast data (e.g. from app-init). */
  updateData(forecasts: ClimateForecast[]): void {
    this._forecasts = forecasts;
    this.setCount(forecasts.length);
    this._render();
  }

  private async _loadData(): Promise<void> {
    try {
      const forecasts = await fetchClimateForecasts();
      this.updateData(forecasts);
    } catch {
      this.showError('Failed to load climate forecasts', () => void this._loadData());
    }
  }

  private _onProvinceClick(f: ClimateForecast): void {
    emit('province-selected', { lat: f.lat, lng: f.lng, province: f.province });
  }

  private _render(): void {
    const root = h('div', { className: 'climate-root' });

    // Alert banner (only when HIGH risk exists)
    const banner = buildAlertBanner(this._forecasts);
    if (banner) root.appendChild(banner);

    // Province table
    if (this._forecasts.length > 0) {
      root.appendChild(buildTable(this._forecasts, (f) => this._onProvinceClick(f)));
    } else {
      root.appendChild(h('p', { className: 'climate-footer' }, 'Không có dữ liệu.'));
    }

    // Data attribution footer
    root.appendChild(
      h('p', { className: 'climate-footer' }, 'Dữ liệu thời tiết: Open-Meteo'),
    );

    this.setContentNode(root);
  }
}

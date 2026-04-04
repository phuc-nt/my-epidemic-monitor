/**
 * Province Deep Dive Panel.
 * Shows detailed outbreak, climate risk, and news data for a selected province.
 * Activated via 'province-selected' event or direct setProvince() call.
 * Rendering helpers live in province-deep-dive-renderers.ts.
 */
import '@/styles/province-dive.css';
import { Panel } from '@/components/panel-base';
import { h } from '@/utils/dom-utils';
import { ctx, on } from '@/app/app-context';
import { fetchClimateForecasts, type ClimateForecast } from '@/services/climate-service';
import type { DiseaseOutbreakItem, NewsItem } from '@/types';
import {
  provincesMatch,
  normalizeProvince,
  buildOutbreaksSection,
  buildClimateSection,
  buildNewsSection,
  buildTotals,
} from '@/components/province-deep-dive-renderers';

// ---------------------------------------------------------------------------
// Panel class
// ---------------------------------------------------------------------------

export class ProvinceDeepDivePanel extends Panel {
  private _currentProvince: string | null = null;
  private _climateCache: ClimateForecast[] = [];

  constructor() {
    super({
      id: 'province-deep-dive',
      title: 'Province Deep Dive',
      defaultRowSpan: 3,
    });

    this._renderPlaceholder();

    // Listen for province-selected events from map clicks or climate panel
    on('province-selected', (data) => {
      if (typeof data === 'string') {
        void this.setProvince(data);
      } else if (data && typeof (data as { province?: string }).province === 'string') {
        void this.setProvince((data as { province: string }).province);
      }
    });

    // Pre-fetch climate data so it's ready when a province is selected
    void this._preloadClimate();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Select a province and render its detailed breakdown.
   * Fetches climate forecasts if not yet cached.
   */
  async setProvince(name: string): Promise<void> {
    this._currentProvince = name;
    this.showLoading();

    if (this._climateCache.length === 0) {
      try {
        this._climateCache = await fetchClimateForecasts();
      } catch {
        // Non-fatal — climate section omitted when unavailable
        this._climateCache = [];
      }
    }

    this._render();
  }

  /**
   * Inject pre-fetched climate forecasts (avoids a redundant network call).
   */
  setClimate(forecasts: ClimateForecast[]): void {
    this._climateCache = forecasts;
    if (this._currentProvince) this._render();
  }

  // ---------------------------------------------------------------------------
  // Private: data helpers
  // ---------------------------------------------------------------------------

  private _getProvinceOutbreaks(): DiseaseOutbreakItem[] {
    if (!this._currentProvince) return [];
    return ctx.outbreaks
      .filter(ob => ob.province && provincesMatch(ob.province, this._currentProvince!))
      .sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0));
  }

  private _getClimateForecast(): ClimateForecast | null {
    if (!this._currentProvince) return null;
    return this._climateCache.find(
      fc => provincesMatch(fc.province, this._currentProvince!),
    ) ?? null;
  }

  private _getProvinceNews(): NewsItem[] {
    if (!this._currentProvince) return [];
    const normalized = normalizeProvince(this._currentProvince);
    return ctx.news.filter(item => {
      const titleNorm = normalizeProvince(item.title);
      return (
        titleNorm.includes(normalized) ||
        normalized.split(' ').some(word => word.length > 3 && titleNorm.includes(word))
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Private: rendering
  // ---------------------------------------------------------------------------

  private _renderPlaceholder(): void {
    this.setContentNode(
      h('div', { className: 'province-placeholder' },
        'Select a province on the map or click a climate alert',
      ),
    );
  }

  private _render(): void {
    if (!this._currentProvince) {
      this._renderPlaceholder();
      return;
    }

    const outbreaks = this._getProvinceOutbreaks();
    const climate   = this._getClimateForecast();
    const news      = this._getProvinceNews();

    const root = h('div', { className: 'province-dive-root' });
    root.appendChild(h('h3', { className: 'province-dive-name' }, `🏥 ${this._currentProvince}`));
    root.appendChild(buildOutbreaksSection(outbreaks));
    if (climate) root.appendChild(buildClimateSection(climate));
    if (news.length > 0) root.appendChild(buildNewsSection(news));
    root.appendChild(buildTotals(outbreaks));

    this.setContentNode(root);
  }

  // ---------------------------------------------------------------------------
  // Private: climate preload
  // ---------------------------------------------------------------------------

  private async _preloadClimate(): Promise<void> {
    try {
      this._climateCache = await fetchClimateForecasts();
    } catch {
      // Silent — retried on first setProvince() call
    }
  }
}

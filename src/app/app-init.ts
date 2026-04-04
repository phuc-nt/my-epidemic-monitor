/**
 * Application bootstrap
 * - Builds DOM layout
 * - Mounts MapShell
 * - Creates all disease panels and mounts them into the panels grid
 * - Mounts map layer controls
 * - Fetches outbreak data and propagates to panels + map layers
 * - Wires event bus: outbreak-selected → flyTo + popup; country-selected → CountryHealthPanel
 */

import { createLayout } from '@/app/app-layout';
import { MapShell } from '@/components/map-shell';
import { ctx, on, emit } from '@/app/app-context';

import { DiseaseOutbreaksPanel } from '@/components/disease-outbreaks-panel';
import { EpidemicStatisticsPanel } from '@/components/epidemic-statistics-panel';
import { CountryHealthPanel } from '@/components/country-health-panel';
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { MapPopup } from '@/components/map-popup';
import { MapLayerControls } from '@/components/map-layer-controls';
import { updateMapLayers } from '@/components/map-layers/index';

import { fetchDiseaseOutbreaks } from '@/services/disease-outbreak-service';
import { fetchEpidemicStats } from '@/services/epidemic-stats-service';
import type { DiseaseOutbreakItem } from '@/types';

export async function initApp(): Promise<void> {
  try {
    // 1. Build CSS grid layout
    const { mapContainer, panelsGrid } = createLayout();

    // 2. Mount MapShell
    const mapShell = new MapShell('map');
    ctx.map = mapShell;

    // 3. Instantiate panels
    const outbreaksPanel = new DiseaseOutbreaksPanel();
    const statsPanel     = new EpidemicStatisticsPanel();
    const countryPanel   = new CountryHealthPanel();
    const trendPanel     = new TrendChartPanel();

    // 4. Mount panels into grid
    panelsGrid.appendChild(outbreaksPanel.el);
    panelsGrid.appendChild(statsPanel.el);
    panelsGrid.appendChild(countryPanel.el);
    panelsGrid.appendChild(trendPanel.el);

    // 5. Store panel refs in context
    ctx.panels.set(outbreaksPanel.id, outbreaksPanel);
    ctx.panels.set(statsPanel.id,     statsPanel);
    ctx.panels.set(countryPanel.id,   countryPanel);
    ctx.panels.set(trendPanel.id,     trendPanel);

    // 6. Mount map layer controls (top-left overlay on the map)
    new MapLayerControls(mapContainer);

    // 7. Create map popup (hidden until a marker is clicked)
    const popup = new MapPopup(mapContainer);

    // 8. Wire event bus — outbreak-selected: fly to + show popup
    on('outbreak-selected', (data) => {
      const item = data as DiseaseOutbreakItem;
      if (item.lat != null && item.lng != null) {
        mapShell.flyTo([item.lng, item.lat], 5);
        const cx = mapContainer.clientWidth  / 2;
        const cy = mapContainer.clientHeight / 2;
        popup.show(item, cx, cy);
      }
    });

    // 9. Respond to window resize
    window.addEventListener('resize', () => {
      ctx.isMobile = window.innerWidth < 768;
    });

    // 10. Fetch data — graceful degradation on failure
    try {
      outbreaksPanel.showLoading();
      statsPanel.showLoading();

      // Parallel fetch: outbreaks + stats
      const [outbreaks, stats] = await Promise.all([
        fetchDiseaseOutbreaks(),
        fetchEpidemicStats(),
      ]);

      ctx.outbreaks = outbreaks;

      outbreaksPanel.updateData(outbreaks);
      statsPanel.updateData(stats);

      // Build per-country risk score map for choropleth
      const riskWeight: Record<string, number> = { alert: 1, warning: 0.6, watch: 0.3 };
      const riskScores = new Map<string, number>();
      for (const o of outbreaks) {
        const prev  = riskScores.get(o.countryCode) ?? 0;
        const score = riskWeight[o.alertLevel] ?? 0.2;
        if (score > prev) riskScores.set(o.countryCode, score);
      }

      // Wire map layers (choropleth skipped — no GeoJSON loaded yet)
      updateMapLayers(mapShell, outbreaks, riskScores, null, {
        onMarkerClick: (item) => emit('outbreak-selected', item),
        onCountryClick: (code) => {
          const profile = ctx.countryProfiles.get(code);
          if (profile) emit('country-selected', profile);
        },
      });
    } catch (fetchErr) {
      console.warn('[EpidemicMonitor] Data fetch failed, showing empty state:', fetchErr);
      outbreaksPanel.showError('Could not load outbreak data.', () => window.location.reload());
      statsPanel.showError('Statistics unavailable.');
    }

    console.info('[EpidemicMonitor] App initialized');
  } catch (err) {
    console.error('[EpidemicMonitor] Failed to initialize app:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<div style="color:#e03e3e;padding:24px;font-family:sans-serif">' +
        'Failed to load Epidemic Monitor. Please refresh the page.</div>';
    }
  }
}

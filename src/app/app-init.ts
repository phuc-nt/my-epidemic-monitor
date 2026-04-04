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
import { h } from '@/utils/dom-utils';
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
import { fetchHealthNews } from '@/services/news-feed-service';
import { invalidateCache } from '@/services/fetch-cache';
import { NewsFeedPanel } from '@/components/news-feed-panel';
import { ChatPanel } from '@/components/chat-panel';
import { ClimateAlertsPanel } from '@/components/climate-alerts-panel';
import { CaseReportPanel } from '@/components/case-report-panel';
import { initLLM, chat } from '@/services/llm-router';
import { buildMessages } from '@/services/llm-context-builder';
import { processOutbreaks, processNews, setLLMComplete } from '@/services/llm-data-pipeline';
import { complete } from '@/services/llm-router';
import { fetchClimateForecasts } from '@/services/climate-service';
import { initSnapshotDB, saveSnapshot, getRecentSnapshots, pruneOldSnapshots } from '@/services/snapshot-store';
import { computeStatsDelta, computeAllTrends, detectEscalations, detectEarlyWarnings } from '@/services/trend-calculator';
import { setEarlyWarnings, setDistrictGeoJson } from '@/components/map-layers/index';
import { BreakingNewsBanner } from '@/components/breaking-news-banner';
import { CrossSourceSignalsPanel } from '@/components/cross-source-signals-panel';
import { ProvinceDeepDivePanel } from '@/components/province-deep-dive-panel';
import { detectCrossSourceSignals } from '@/services/cross-source-signal-service';
import type { DiseaseOutbreakItem, EpidemicStats, NewsItem } from '@/types';

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
    const newsPanel      = new NewsFeedPanel();
    const chatPanel      = new ChatPanel();
    const climatePanel   = new ClimateAlertsPanel();
    const caseReportPanel = new CaseReportPanel();
    const signalsPanel   = new CrossSourceSignalsPanel();
    const provinceDive   = new ProvinceDeepDivePanel();
    const banner         = new BreakingNewsBanner();

    // 4. Mount panels into tabbed groups
    const tabGroups: Record<string, { label: string; panels: HTMLElement[] }> = {
      dashboard: { label: 'Dashboard', panels: [outbreaksPanel.el, climatePanel.el, statsPanel.el, newsPanel.el] },
      analysis:  { label: 'Analysis',  panels: [signalsPanel.el, provinceDive.el, trendPanel.el, countryPanel.el] },
      tools:     { label: 'Tools',     panels: [caseReportPanel.el, chatPanel.el] },
    };

    // Build tab bar
    const tabBar = h('div', { className: 'panel-tab-bar' });
    let activeTab = 'dashboard';

    function showTab(tabId: string): void {
      activeTab = tabId;
      // Update tab buttons
      for (const btn of tabBar.querySelectorAll('.panel-tab-btn')) {
        btn.classList.toggle('panel-tab-btn--active', (btn as HTMLElement).dataset['tab'] === tabId);
      }
      // Show/hide panel groups
      for (const [id, group] of Object.entries(tabGroups)) {
        for (const el of group.panels) {
          el.style.display = id === tabId ? '' : 'none';
        }
      }
    }

    for (const [id, group] of Object.entries(tabGroups)) {
      const btn = h('button', {
        className: `panel-tab-btn${id === activeTab ? ' panel-tab-btn--active' : ''}`,
        dataset: { tab: id },
      }, group.label);
      btn.addEventListener('click', () => showTab(id));
      tabBar.appendChild(btn);
    }

    // Data age indicator + refresh button
    const dataAge = h('span', { className: 'data-age-indicator' }, 'Loading...');
    const refreshBtn = h('button', { className: 'data-refresh-btn', title: 'Refresh data' }, '⟳');
    const rightGroup = h('div', { className: 'tab-bar-right' }, dataAge, refreshBtn);
    tabBar.appendChild(rightGroup);

    panelsGrid.insertBefore(tabBar, panelsGrid.firstChild);

    // Mount all panels (visibility controlled by showTab)
    for (const group of Object.values(tabGroups)) {
      for (const el of group.panels) panelsGrid.appendChild(el);
    }
    showTab('dashboard');

    // 5. Store panel refs in context
    ctx.panels.set(outbreaksPanel.id, outbreaksPanel);
    ctx.panels.set(climatePanel.id,   climatePanel);
    ctx.panels.set(statsPanel.id,     statsPanel);
    ctx.panels.set(newsPanel.id,      newsPanel);
    ctx.panels.set(caseReportPanel.id, caseReportPanel);
    ctx.panels.set(chatPanel.id,      chatPanel);
    ctx.panels.set(countryPanel.id,   countryPanel);
    ctx.panels.set(trendPanel.id,     trendPanel);
    ctx.panels.set(signalsPanel.id,  signalsPanel);
    ctx.panels.set(provinceDive.id,  provinceDive);

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

    // 10. Data fetch + refresh logic
    let lastFetchTime = 0;

    function updateDataAge(): void {
      if (!lastFetchTime) { dataAge.textContent = 'Loading...'; return; }
      const secs = Math.floor((Date.now() - lastFetchTime) / 1000);
      if (secs < 60) dataAge.textContent = `Updated ${secs}s ago`;
      else if (secs < 3600) dataAge.textContent = `Updated ${Math.floor(secs / 60)}m ago`;
      else dataAge.textContent = `Updated ${Math.floor(secs / 3600)}h ago`;
    }

    async function fetchAllData(): Promise<{ outbreaks: DiseaseOutbreakItem[]; stats: EpidemicStats; news: NewsItem[] }> {
      invalidateCache('disease-outbreaks');
      invalidateCache('epidemic-stats');
      invalidateCache('health-news');

      const [outbreaks, stats, news] = await Promise.all([
        fetchDiseaseOutbreaks(),
        fetchEpidemicStats(),
        fetchHealthNews(),
      ]);
      lastFetchTime = Date.now();
      updateDataAge();
      return { outbreaks, stats, news };
    }

    function applyData(outbreaks: DiseaseOutbreakItem[], stats: EpidemicStats, news: NewsItem[]): void {
      ctx.outbreaks = outbreaks;
      ctx.news = news;

      outbreaksPanel.updateData(outbreaks);
      newsPanel.updateData(news);

      // Cross-source signal detection
      const signals = detectCrossSourceSignals(outbreaks, news);
      signalsPanel.updateData(signals, outbreaks);

      // Breaking news banner
      const alertOutbreaks = outbreaks.filter(o => o.alertLevel === 'alert');
      if (alertOutbreaks.length > 0) {
        const top = alertOutbreaks[0];
        const totalCases = alertOutbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
        banner.show(
          `${top.disease} — ${alertOutbreaks.length} ổ dịch cấp ALERT, ${totalCases.toLocaleString()} ca`,
          'alert',
        );
      }
    }

    // Initial fetch
    outbreaksPanel.showLoading();
    statsPanel.showLoading();
    newsPanel.showLoading();

    let outbreaks: DiseaseOutbreakItem[];
    let stats: EpidemicStats;
    let news: NewsItem[];

    try {
      ({ outbreaks, stats, news } = await fetchAllData());
      console.info(`[EpidemicMonitor] Live data — ${outbreaks.length} outbreaks, ${news.length} news`);
    } catch (err) {
      console.error('[EpidemicMonitor] Data fetch failed:', err);
      outbreaks = [];
      stats = { totalOutbreaks: 0, activeAlerts: 0, countriesAffected: 0, topDiseases: [], lastUpdated: 0 };
      news = [];
    }
    applyData(outbreaks, stats, news);

    // Shared refresh logic — saves snapshot for timeline accumulation
    async function refreshData(silent = false): Promise<void> {
      const fresh = await fetchAllData();
      applyData(fresh.outbreaks, fresh.stats, fresh.news);
      // Re-run LLM pipeline (entity extraction, dedup) on fresh data
      void processOutbreaks(fresh.outbreaks);
      void processNews(fresh.news);
      // Accumulate snapshot for historical timeline
      void saveSnapshot(fresh.outbreaks);
      if (!silent) console.info(`[EpidemicMonitor] Refreshed — ${fresh.outbreaks.length} outbreaks, ${fresh.news.length} news`);
    }

    // Refresh button handler
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('refreshing');
      dataAge.textContent = 'Refreshing...';
      try {
        await refreshData();
      } catch (err) {
        console.error('[EpidemicMonitor] Refresh failed:', err);
        dataAge.textContent = 'Refresh failed';
      }
      refreshBtn.classList.remove('refreshing');
    });

    // Auto-refresh every 5 minutes — accumulates snapshots for timeline
    setInterval(async () => {
      try { await refreshData(true); } catch { /* Silent retry next interval */ }
    }, 5 * 60 * 1000);

    // Update age indicator every 30 seconds
    setInterval(updateDataAge, 30_000);

    // Snapshot store: save current data + compute trends
    try {
      await initSnapshotDB();
      await saveSnapshot(outbreaks);
      void pruneOldSnapshots(30);

      const snapshots = await getRecentSnapshots(30);
      const delta = computeStatsDelta(snapshots);
      statsPanel.updateDataWithDelta(stats, delta);

      // Feed trend chart with top disease
      const trends = computeAllTrends(snapshots);
      if (trends.length > 0) {
        const top = trends[0];
        trendPanel.setData(top.disease, top.points.map(p => p.value));
      }

      // Detect alert escalations (watch→warning→alert)
      const escalations = detectEscalations(snapshots);
      if (escalations.length > 0) {
        outbreaksPanel.setEscalations(escalations);
      }
    } catch {
      // IndexedDB unavailable — show stats without delta
      statsPanel.updateData(stats);
    }

    // Build per-country risk score map for choropleth
    const riskWeight: Record<string, number> = { alert: 1, warning: 0.6, watch: 0.3 };
    const riskScores = new Map<string, number>();
    for (const o of outbreaks) {
      const prev  = riskScores.get(o.countryCode) ?? 0;
      const score = riskWeight[o.alertLevel] ?? 0.2;
      if (score > prev) riskScores.set(o.countryCode, score);
    }

    // Wire map layers
    const mapCallbacks = {
      onMarkerClick: (item: DiseaseOutbreakItem) => emit('outbreak-selected', item),
      onCountryClick: (code: string) => {
        const profile = ctx.countryProfiles.get(code);
        if (profile) emit('country-selected', profile);
      },
    };
    updateMapLayers(mapShell, outbreaks, riskScores, null, mapCallbacks);

    // Time filter: re-render map layers with filtered outbreaks
    on('time-filter-changed', (data) => {
      const ms = data as number;
      const now = Date.now();
      const filtered = ms > 0
        ? outbreaks.filter(o => (now - o.publishedAt) <= ms)
        : outbreaks;
      updateMapLayers(mapShell, filtered, riskScores, null, mapCallbacks);
      outbreaksPanel.updateData(filtered);
    });

    // 11. Load district GeoJSON boundaries (non-blocking)
    fetch('/data/vietnam-districts.geojson')
      .then(r => r.json())
      .then(geoJson => {
        setDistrictGeoJson(geoJson);
        console.info(`[EpidemicMonitor] District boundaries loaded: ${geoJson.features?.length} districts`);
      })
      .catch(() => { /* District boundaries optional — map still works without */ });

    // 12. Fetch climate forecasts + compute early warnings (non-blocking)
    fetchClimateForecasts().then((forecasts) => {
      climatePanel.updateData(forecasts);
      provinceDive.setClimate(forecasts);

      // Early warnings: provinces with HIGH climate risk but NO active outbreak
      const outbreakProvinces = new Set(outbreaks.map(o => o.country));
      const warnings = detectEarlyWarnings(forecasts, outbreakProvinces);
      if (warnings.length > 0) {
        setEarlyWarnings(warnings);
        console.info(`[EpidemicMonitor] ${warnings.length} early warning(s): ${warnings.map(w => w.province).join(', ')}`);
      }
    }).catch(() => {
      // Climate panel shows sample data via service fallback
    });

    // Wire province-selected from climate panel → map flyTo
    on('province-selected', (data) => {
      const { lat, lng } = data as { lat: number; lng: number; province: string };
      mapShell.flyTo([lng, lat], 8);
    });

    // 12. Initialize LLM (non-blocking — chat works without it)
    initLLM().then((provider) => {
      if (provider) {
        chatPanel.setStatus(`${provider.config.name} (${provider.config.model})`, true);

        // Wire data pipeline LLM functions
        setLLMComplete(complete);

        // Run data pipeline cleanup
        void processOutbreaks(outbreaks);
        void processNews(news);

        // Wire chat send → LLM streaming
        chatPanel.onSend = (text) => {
          const history = chatPanel.getHistory()
            .filter(m => m.role !== 'assistant' || !m.content.startsWith('Xin chào'))
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
          const messages = buildMessages(text, history);

          chat(
            messages,
            (chunk) => chatPanel.appendChunk(chunk),
            () => chatPanel.endStreaming(),
          ).catch(() => {
            chatPanel.appendChunk('\n[Error: LLM request failed]');
            chatPanel.endStreaming();
          });
        };
      } else {
        chatPanel.setStatus('No LLM available — set OpenRouter API key in settings', false);
      }
    }).catch(() => {
      chatPanel.setStatus('LLM init failed', false);
    });

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

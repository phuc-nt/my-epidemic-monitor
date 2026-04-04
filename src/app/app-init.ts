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
import { fetchHealthNews } from '@/services/news-feed-service';
import { SAMPLE_OUTBREAKS, SAMPLE_STATS, SAMPLE_NEWS } from '@/services/sample-data';
import { NewsFeedPanel } from '@/components/news-feed-panel';
import { ChatPanel } from '@/components/chat-panel';
import { ClimateAlertsPanel } from '@/components/climate-alerts-panel';
import { CaseReportPanel } from '@/components/case-report-panel';
import { initLLM, chat } from '@/services/llm-router';
import { buildMessages } from '@/services/llm-context-builder';
import { processOutbreaks, processNews, setLLMComplete } from '@/services/llm-data-pipeline';
import { complete } from '@/services/llm-router';
import { fetchClimateForecasts } from '@/services/climate-service';
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
    const newsPanel      = new NewsFeedPanel();
    const chatPanel      = new ChatPanel();
    const climatePanel   = new ClimateAlertsPanel();
    const caseReportPanel = new CaseReportPanel();

    // 4. Mount panels into grid
    panelsGrid.appendChild(outbreaksPanel.el);
    panelsGrid.appendChild(climatePanel.el);
    panelsGrid.appendChild(statsPanel.el);
    panelsGrid.appendChild(newsPanel.el);
    panelsGrid.appendChild(caseReportPanel.el);
    panelsGrid.appendChild(chatPanel.el);
    panelsGrid.appendChild(countryPanel.el);
    panelsGrid.appendChild(trendPanel.el);

    // 5. Store panel refs in context
    ctx.panels.set(outbreaksPanel.id, outbreaksPanel);
    ctx.panels.set(climatePanel.id,   climatePanel);
    ctx.panels.set(statsPanel.id,     statsPanel);
    ctx.panels.set(newsPanel.id,      newsPanel);
    ctx.panels.set(caseReportPanel.id, caseReportPanel);
    ctx.panels.set(chatPanel.id,      chatPanel);
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

    // 10. Fetch data — fallback to sample data when API unavailable
    outbreaksPanel.showLoading();
    statsPanel.showLoading();
    newsPanel.showLoading();

    let outbreaks: DiseaseOutbreakItem[];
    let stats;
    let news;

    try {
      [outbreaks, stats, news] = await Promise.all([
        fetchDiseaseOutbreaks(),
        fetchEpidemicStats(),
        fetchHealthNews(),
      ]);
      // Use sample data if API returned empty
      if (!outbreaks.length) outbreaks = SAMPLE_OUTBREAKS;
      if (!stats.totalOutbreaks) stats = SAMPLE_STATS;
      if (!news.length) news = SAMPLE_NEWS;
    } catch {
      console.info('[EpidemicMonitor] API unavailable, using sample Vietnam data');
      outbreaks = SAMPLE_OUTBREAKS;
      stats = SAMPLE_STATS;
      news = SAMPLE_NEWS;
    }

    ctx.outbreaks = outbreaks;
    ctx.news = news;

    outbreaksPanel.updateData(outbreaks);
    statsPanel.updateData(stats);
    newsPanel.updateData(news);

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

    // 11. Fetch climate forecasts (non-blocking)
    fetchClimateForecasts().then((forecasts) => {
      climatePanel.updateData(forecasts);
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

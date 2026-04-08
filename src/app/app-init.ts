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
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { MapPopup } from '@/components/map-popup';
import { MapLayerControls } from '@/components/map-layer-controls';
import { updateMapLayers } from '@/components/map-layers/index';

import { fetchDiseaseOutbreaks } from '@/services/disease-outbreak-service';
import { fetchEpidemicStats } from '@/services/epidemic-stats-service';
import { fetchHealthNews } from '@/services/news-feed-service';
import { invalidateCache } from '@/services/fetch-cache';
import { fetchBulkData, invalidateBulkCache } from '@/services/bulk-data-service';
import { NewsFeedPanel } from '@/components/news-feed-panel';
import { ChatPanel } from '@/components/chat-panel';
import { ClimateAlertsPanel } from '@/components/climate-alerts-panel';
import { diseaseLabel } from '@/components/case-report-panel-data';
import { initLLM, chat } from '@/services/llm-router';
import { buildMessages } from '@/services/llm-context-builder';
import { processOutbreaks, processNews, setLLMComplete } from '@/services/llm-data-pipeline';
import { complete } from '@/services/llm-router';
import { fetchClimateForecasts } from '@/services/climate-service';
import { initSnapshotDB, saveSnapshot, getRecentSnapshots, pruneOldSnapshots } from '@/services/snapshot-store';
import { computeStatsDelta, computeAllTrends, detectEscalations, detectEarlyWarnings } from '@/services/trend-calculator';
import { setEarlyWarnings, setDistrictGeoJson, setHighlightedProvince, setSelectedDate } from '@/components/map-layers/index';
import { BreakingNewsBanner } from '@/components/breaking-news-banner';
import type { DiseaseOutbreakItem, EpidemicStats, NewsItem } from '@/types';

export async function initApp(): Promise<void> {
  try {
    // 1. Build CSS grid layout
    const { mapContainer, panelsGrid } = createLayout();

    // 2. Mount MapShell
    const mapShell = new MapShell('map');
    ctx.map = mapShell;

    // 3. Instantiate panels (slim layout — chat is floating, not tabbed)
    const outbreaksPanel = new DiseaseOutbreaksPanel();
    const statsPanel     = new EpidemicStatisticsPanel();
    const trendPanel     = new TrendChartPanel();
    const newsPanel      = new NewsFeedPanel();
    const chatPanel      = new ChatPanel();
    const climatePanel   = new ClimateAlertsPanel();
    const banner         = new BreakingNewsBanner();

    // 4. Mount panels into 2 tabs (Tools tab removed; Case Report removed)
    const tabGroups: Record<string, { label: string; panels: HTMLElement[] }> = {
      dashboard: { label: 'Dashboard', panels: [outbreaksPanel.el, climatePanel.el] },
      analysis:  { label: 'Analysis',  panels: [statsPanel.el, newsPanel.el, trendPanel.el] },
    };

    // Build tab bar
    const tabBar = h('div', { className: 'panel-tab-bar' });
    let activeTab = 'dashboard';

    // Alert summary strip — only visible in Dashboard tab, shows counts per level
    const summaryStrip = h('div', { className: 'alert-summary-strip' });

    function showTab(tabId: string): void {
      activeTab = tabId;
      for (const btn of tabBar.querySelectorAll('.panel-tab-btn')) {
        btn.classList.toggle('panel-tab-btn--active', (btn as HTMLElement).dataset['tab'] === tabId);
      }
      for (const [id, group] of Object.entries(tabGroups)) {
        for (const el of group.panels) {
          el.style.display = id === tabId ? '' : 'none';
        }
      }
      // Summary strip only relevant on Dashboard
      summaryStrip.style.display = tabId === 'dashboard' ? '' : 'none';
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

    // Timeline bar — 7-day date selector
    const todayStr = new Date().toISOString().split('T')[0];
    let _selectedDate = todayStr;
    const timelineBar = h('div', { className: 'timeline-bar' });
    const timelineDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i)); // oldest → newest
      return d.toISOString().split('T')[0];
    });

    const DOW_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const tlBtns = new Map<string, HTMLElement>();
    for (const day of timelineDays) {
      const d = new Date(day + 'T00:00:00');
      const isToday = day === todayStr;
      const dowLabel  = isToday ? 'HN' : DOW_VN[d.getDay()];
      const dateLabel = isToday ? 'Hôm nay' : `${d.getDate()}/${d.getMonth() + 1}`;
      const btn = h('button', {
        className: `timeline-day-btn${isToday ? ' timeline-day-btn--active' : ''}`,
        dataset: { date: day },
        title: day,
      },
        h('span', { className: 'tl-dow' }, dowLabel),
        h('span', { className: 'tl-date' }, dateLabel),
        h('span', { className: 'tl-count', style: 'display:none' }, ''),
      );
      btn.addEventListener('click', () => emit('day-selected', day));
      tlBtns.set(day, btn);
      timelineBar.appendChild(btn);
    }
    panelsGrid.insertBefore(timelineBar, tabBar.nextSibling);

    // Insert summary strip after the timeline bar
    panelsGrid.insertBefore(summaryStrip, timelineBar.nextSibling);

    /** Update count badges on each timeline day button after data loads. */
    function updateTimelineCounts(allOutbreaks: DiseaseOutbreakItem[]): void {
      for (const [day, btn] of tlBtns) {
        const count = allOutbreaks.filter(o =>
          new Date(o.publishedAt).toISOString().split('T')[0] === day
        ).length;
        const badge = btn.querySelector('.tl-count') as HTMLElement | null;
        if (badge) {
          badge.textContent = count > 0 ? String(count) : '';
          badge.style.display = count > 0 ? '' : 'none';
        }
      }
    }

    /** Rebuild the alert summary strip for a given date's outbreaks. */
    function updateSummaryStrip(allOutbreaks: DiseaseOutbreakItem[], date?: string): void {
      const items = date
        ? allOutbreaks.filter(o => new Date(o.publishedAt).toISOString().split('T')[0] === date)
        : allOutbreaks;
      const alertCnt   = items.filter(o => o.alertLevel === 'alert').length;
      const warnCnt    = items.filter(o => o.alertLevel === 'warning').length;
      const watchCnt   = items.filter(o => o.alertLevel === 'watch').length;

      summaryStrip.textContent = '';
      const pill = (count: number, label: string, cls: string) =>
        h('div', { className: `summary-pill ${cls}` },
          h('span', { className: 'summary-pill-count' }, String(count)),
          h('span', { className: 'summary-pill-label' }, label),
        );
      summaryStrip.appendChild(pill(alertCnt, 'Alert', 'summary-pill--alert'));
      summaryStrip.appendChild(pill(warnCnt,  'Warning', 'summary-pill--warning'));
      summaryStrip.appendChild(pill(watchCnt, 'Watch', 'summary-pill--watch'));
      summaryStrip.appendChild(
        h('div', { className: 'summary-total' }, `${items.length} điểm nóng`),
      );
    }

    // Mount all panels (visibility controlled by showTab)
    for (const group of Object.values(tabGroups)) {
      for (const el of group.panels) panelsGrid.appendChild(el);
    }
    showTab('dashboard');

    // Mount floating chat widget — chat icon (FAB) + collapsible overlay
    const chatOverlay = h('div', { className: 'chat-overlay' }, chatPanel.el);
    const chatFab = h('button', {
      className: 'chat-fab',
      title: 'AI Assistant — Hỏi đáp về dữ liệu dịch bệnh',
    }, '💬');
    let chatOpen = false;
    chatFab.addEventListener('click', () => {
      chatOpen = !chatOpen;
      chatOverlay.classList.toggle('chat-overlay--open', chatOpen);
      chatFab.classList.toggle('chat-fab--open', chatOpen);
      chatFab.textContent = chatOpen ? '✕' : '💬';
    });
    document.body.appendChild(chatOverlay);
    document.body.appendChild(chatFab);

    // Footer — prominent author credit card with avatar + social links
    const footer = h('div', { className: 'author-footer' },
      h('div', { className: 'author-footer-avatar' }, 'PN'),
      h('div', { className: 'author-footer-info' },
        h('span', { className: 'author-footer-name' }, 'Phúc Nguyễn'),
        h('span', { className: 'author-footer-tagline' }, 'Creator · Epidemic Monitor'),
      ),
      h('div', { className: 'author-footer-links' },
        h('a', { href: 'https://github.com/phuc-nt', target: '_blank', rel: 'noopener noreferrer', title: 'GitHub', 'aria-label': 'GitHub' }, 'GH'),
        h('a', { href: 'https://www.linkedin.com/in/nguyen-trong-phuc', target: '_blank', rel: 'noopener noreferrer', title: 'LinkedIn', 'aria-label': 'LinkedIn' }, 'in'),
        h('a', { href: 'https://phucnt.substack.com', target: '_blank', rel: 'noopener noreferrer', title: 'Substack', 'aria-label': 'Substack' }, 'SS'),
      ),
    );
    mapContainer.appendChild(footer);

    // 5. Store panel refs in context
    ctx.panels.set(outbreaksPanel.id, outbreaksPanel);
    ctx.panels.set(climatePanel.id,   climatePanel);
    ctx.panels.set(statsPanel.id,     statsPanel);
    ctx.panels.set(newsPanel.id,      newsPanel);
    ctx.panels.set(chatPanel.id,      chatPanel);
    ctx.panels.set(trendPanel.id,     trendPanel);

    // 6. Mount map layer controls (top-left overlay on the map)
    new MapLayerControls(mapContainer);

    // 7. Create map popup (hidden until a marker is clicked)
    const popup = new MapPopup(mapContainer);

    // 8. Wire event bus — outbreak-selected: fly to + show popup
    const UNLOCATED_PROVINCES = new Set(['Toàn quốc', 'phía Nam', 'ĐBSCL']);
    on('outbreak-selected', (data) => {
      const item = data as DiseaseOutbreakItem;
      const isUnlocated = UNLOCATED_PROVINCES.has(item.province ?? '') || !item.province;
      if (isUnlocated) {
        // Zoom out to full Vietnam view for nationwide outbreaks
        mapShell.flyTo([108.0, 16.0], 5);
      } else if (item.lat != null && item.lng != null) {
        mapShell.flyTo([item.lng, item.lat], 8);
      }
      const cx = mapContainer.clientWidth  / 2;
      const cy = mapContainer.clientHeight / 2;
      popup.show(item, cx, cy);
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
      invalidateBulkCache();

      try {
        // Single API call: outbreaks + stats + news in one request (saves ~67% function invocations)
        const bulk = await fetchBulkData();
        lastFetchTime = Date.now();
        updateDataAge();
        return bulk;
      } catch {
        // Fallback to individual calls if bulk endpoint unavailable
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
    }

    function applyData(outbreaks: DiseaseOutbreakItem[], stats: EpidemicStats, news: NewsItem[]): void {
      ctx.outbreaks = outbreaks;
      ctx.news = news;

      outbreaksPanel.updateData(outbreaks);
      newsPanel.updateData(news);

      // Update timeline count badges + summary strip with latest data
      updateTimelineCounts(outbreaks);
      updateSummaryStrip(outbreaks); // show all 7-day summary by default

      // Breaking news banner
      const alertOutbreaks = outbreaks.filter(o => o.alertLevel === 'alert');
      if (alertOutbreaks.length > 0) {
        const top = alertOutbreaks[0];
        const totalCases = alertOutbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);
        banner.show(
          `${diseaseLabel(top.disease)} — ${alertOutbreaks.length} ổ dịch cấp ALERT, ${totalCases.toLocaleString()} ca`,
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
      // Re-run LLM pipeline on copies to avoid mutating panel-held arrays
      void processOutbreaks([...fresh.outbreaks]);
      void processNews([...fresh.news]);
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
      // Map marker click: show popup + filter list + highlight province
      onMarkerClick: (item: DiseaseOutbreakItem) => {
        emit('outbreak-selected', item);
        emit('map-marker-clicked', item);
      },
      onCountryClick: (code: string) => {
        const profile = ctx.countryProfiles.get(code);
        if (profile) emit('country-selected', profile);
      },
    };
    updateMapLayers(mapShell, outbreaks, riskScores, null, mapCallbacks);

    // List row click → highlight matching province markers on map
    on('outbreak-selected', (data) => {
      const item = data as DiseaseOutbreakItem;
      if (item.province) setHighlightedProvince(item.province);
    });

    // Province filter cleared from panel → clear map highlight
    on('province-filter-changed', (data) => {
      setHighlightedProvince((data as string | null));
    });

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

    // Day selected on timeline — toggle: click active day → show all; click other → filter
    on('day-selected', (data) => {
      const date = data as string;
      const isDeselect = date === _selectedDate; // clicking already-active day
      _selectedDate = isDeselect ? todayStr : date;

      for (const [day, btn] of tlBtns) {
        btn.classList.toggle('timeline-day-btn--active', isDeselect ? day === todayStr : day === date);
      }

      if (isDeselect) {
        // Deselect → show all 7 days, highlight today on map
        setSelectedDate(todayStr);
        outbreaksPanel.filterByDate(null);
        updateSummaryStrip(ctx.outbreaks);
      } else {
        // Select specific day → filter panel, highlight on map
        setSelectedDate(date);
        outbreaksPanel.filterByDate(date);
        updateSummaryStrip(ctx.outbreaks, date);
      }
    });

    // Default: show ALL 7 days — today highlighted on map
    setSelectedDate(todayStr);
    outbreaksPanel.filterByDate(null); // show all days, not just today

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

        // Run data pipeline cleanup on a COPY to avoid mutating shared state
        // (panels hold references to the original arrays)
        void processOutbreaks([...outbreaks]);
        void processNews([...news]);

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

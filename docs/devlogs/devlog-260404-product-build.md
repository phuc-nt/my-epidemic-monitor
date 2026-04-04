# Devlog 2026-04-04 — Epidemic Monitor MVP Build

## Tổng quan
Xây dựng từ đầu một dashboard theo dõi dịch bệnh truyền nhiễm cho Việt Nam, dựa trên codebase worldmonitor (119 panels, 45 map layers) → stripped down + mở rộng thành 8 panels chuyên biệt.

**Thời gian**: ~4 giờ từ clone → full feature set với 15 E2E tests pass
**Commits**: 14 commits, 47 TS files + 5 CSS files, ~4770 lines code
**Bundle**: 455KB gzipped production build

---

## Timeline

### 06:47 — Clone & Phân tích WorldMonitor
- Clone `koala73/worldmonitor.git` vào workspace
- Dispatch 2 Explore agents song song: kiến trúc tổng thể + epidemic-related code
- Agents bị rate limit → chuyển sang phân tích trực tiếp

**Phát hiện chính:**
- WorldMonitor = Vanilla TS + Vite + deck.gl + MapLibre GL + Protobuf RPC
- 119 panel components, 65+ data sources — quá nặng
- `DiseaseOutbreaksPanel.ts` (146 lines) reusable gần như nguyên
- `Panel.ts` (1180 lines) cần strip 70% (premium/Tauri/analytics/AI)
- `DeckGLMap.ts` (5960 lines) quá complex → viết mới map shell ~70 lines

### 06:50 — Planning (planner agent)
- Delegate cho planner agent tạo 8-phase plan
- Plan output: `plans/260404-0647-epidemic-monitor-mvp/`
- 8 phase files chi tiết với architecture, implementation steps, risks

### 07:00 — Phase 1+2: Setup + Core Architecture
- Delegate cho fullstack-developer agent
- 18 files tạo mới: package.json, vite.config, Panel base class, MapShell, app context, layout, CSS
- `tsc --noEmit` pass, Vite dev server start 351ms

### 07:05 — Phase 3-6: Song song 2 agents
**Agent A** (Phase 3+6): API edge functions + News
- 7 API files: outbreaks (WHO DON RSS), stats, OWID CSV, countries, news (5 RSS feeds)
- 7 client services với stale-while-revalidate cache
- NewsFeedPanel component

**Agent B** (Phase 4+5): Panels + Map Layers
- 4 disease panels: outbreaks, statistics, country health, trend chart
- 3 deck.gl layers: outbreak markers, severity heatmap, country choropleth
- Event bus (on/emit/off), map popup, layer controls
- Wiring trong app-init.ts

Cả 2 hoàn thành, `tsc --noEmit` clean sau merge.

### 07:15 — Phase 7+8: Styling + Deployment
- Thêm CSS cho tất cả component classes (~150 lines CSS bổ sung)
- vercel.json, Dockerfile, nginx.conf, docker-compose.yml, server.cjs
- Fix CSS specificity warning + forEach → for...of

### 07:18 — Testing
- Delegate cho tester agent: typecheck, lint, build (444KB gzipped), dev server
- E2E Playwright: 10 tests, all pass (8.6s)
- Git init + commit

### 07:32 — Vietnam Focus
- Map center → 16°N, 107.5°E (Việt Nam), zoom 5.8
- 63 tỉnh thành VN centroids cho sub-national geocoding
- News feeds: WHO-VN, MOH-VN (Bộ Y tế)
- OWID data ưu tiên VN + Đông Nam Á

### 07:41 — Bug Fixes (browser testing trực tiếp)
- **Map hiển thị sai vùng**: maxBounds = [[100,7.5],[114,24]] lock khu vực VN
- **Panels trống khi API fail**: Thêm sample data VN (8 outbreaks, 5 diseases, 5 news items)
- **DiseaseOutbreaksPanel DOM wipe**: `showLoading()` xóa content → `_remount()` trước `_render()`
- **Outbreak markers không thấy**: Từ 80km radius → 25km + radiusMinPixels 8

### 08:07 — Map Quality
- CartoDB raster tiles (256px) → OpenFreeMap vector tiles (sắc nét)
- `pixelRatio` override gây lỗi interaction → bỏ, MapLibre tự handle DPR
- `dragRotate: false` giữ 2D view

---

## Kiến trúc cuối

```
my-epidemic-monitor/
├── api/                          # 7 edge functions
│   ├── _cache.ts, _cors.ts      # Shared helpers
│   └── health/v1/               # outbreaks, stats, owid, countries, news
├── src/
│   ├── app/                      # Context (+ event bus), layout, init
│   ├── components/               # 8 panels + map shell + layers + popup + controls
│   ├── services/                 # 13 services (data + LLM + climate + case report)
│   ├── types/                    # DiseaseOutbreakItem, NewsItem, ChatMessage, etc.
│   ├── utils/                    # dom, sanitize, storage, sparkline
│   └── styles/                   # Light theme CSS (~830 lines)
├── e2e/                          # 15 Playwright E2E tests
├── Dockerfile, docker-compose.yml, vercel.json
└── package.json                  # Vite + deck.gl + MapLibre
```

## Data Flow
```
WHO DON RSS / MOH-VN / OWID CSV
    ↓ (edge functions proxy + cache)
REST JSON → Client services (SWR cache)
    ↓
App Init → Panels.updateData() + MapLayers.update()
    ↓
Event bus: outbreak-selected → flyTo + popup
           country-selected → CountryHealthPanel
```

## Metrics
| Metric | Value |
|--------|-------|
| TypeScript files | 58 |
| CSS files | 7 |
| Lines of TS code | 5,617 |
| Lines of CSS | ~1,100 |
| Production bundle | 455KB gzipped |
| Dev server startup | ~200ms |
| E2E test suite | 15 tests, 39s |
| Panels | 8 (vs 119 in worldmonitor) |
| Map layers | 5 (vs 45 in worldmonitor) |
| District boundaries | 708 (geoBoundaries VNM ADM2) |
| Disease aliases | 67 (EN + VN, 100% match rate) |
| Data sources | 10 active + 1 static GeoJSON |
| LLM providers | 3 (OpenRouter MiniMax M2.7 default) |
| E2E tests | 29 |
| Git commits | 26 |

## Feature Inventory (final state)

| # | Panel/Feature | Mô tả |
|---|---------------|--------|
| 1 | Disease Outbreaks | 13 alerts (district-level), filter, search, escalation badges |
| 2 | Climate Risk Forecast | Open-Meteo → dengue/HFMD risk 14 ngày, 8 tỉnh, alert banner |
| 3 | Epidemic Statistics | Counters + delta arrows (↑↓) + trend banner + top diseases |
| 4 | Health News | 7 RSS feeds, source filter, LLM-enhanced dedup |
| 5 | Case Report Form | 6 diseases, 63 tỉnh, localStorage queue, recent list |
| 6 | AI Assistant | Chat streaming, MiniMax M2.7/Ollama/MLX, data-grounded |
| 7 | Country Health Profile | Per-country risk + diseases |
| 8 | Disease Trend | SVG sparkline from IndexedDB snapshot time-series |
| 9 | Map Time Filter | 24h/7d/30d/All buttons filter outbreaks |
| 10 | Map Layer Controls | 5 toggles: Districts, Markers, Heatmap, Country, Early Warnings |
| 11 | Map Popup | Click outbreak marker → details popup |
| 12 | District Choropleth | 708 quận/huyện boundaries, fill by severity |
| 13 | Early Warning Overlay | Amber markers for climate HIGH + no outbreak |
| 14 | Alert Escalation | Purple "ESCALATED" badge on severity upgrades |
| 15 | LLM Data Pipeline | 67-alias normalization + batch entity extraction + Jaccard dedup |
| 16 | IndexedDB Snapshots | 30-day outbreak history, trend computation |
| 17 | Breaking News Banner | Auto-show on ALERT outbreaks, dismiss 30s |
| 18 | Cross-Source Signals | Multi-source alignment detection, confidence scoring |
| 19 | Province Deep Dive | Per-province: outbreaks + climate + news + totals |
| 20 | YouTube Video Tab | Health videos WHO/CDC/VTV, click-to-embed |

## Quyết định thiết kế quan trọng
1. **Vanilla TS, không framework** — giữ nguyên pattern worldmonitor, nhẹ, nhanh
2. **REST/JSON thay protobuf** — đơn giản hóa, không cần codegen
3. **Sample data fallback** — dev mode không cần backend, vẫn thấy UI đầy đủ
4. **OpenFreeMap bright vector tiles** — free, no API key, light theme sắc nét
5. **maxBounds lock VN** — map giới hạn khu vực Việt Nam + lân cận
6. **63 tỉnh thành centroids** — outbreak geocoding chính xác đến cấp tỉnh
7. **Multi-provider LLM** — OpenRouter default (web), Ollama/MLX optional (local)
8. **Climate risk scoring** — temperature + rainfall + humidity → dengue/HFMD risk
9. **Offline case reporting** — localStorage queue, sync-ready architecture

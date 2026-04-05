# Development Roadmap — Epidemic Monitor

## Completed (2026-04-04)

### MVP (8 phases)
- [x] Project setup (Vite + TypeScript + deck.gl + MapLibre)
- [x] Core architecture (Panel base, MapShell, AppContext, event bus)
- [x] Data sources (9 feeds: WHO DON, CDC, MOH-VN, OWID, etc.)
- [x] Disease panels (Outbreaks, Statistics, Country, Trend)
- [x] Map layers (outbreak markers, severity heatmap, choropleth)
- [x] News feed (7 RSS sources, source filter)
- [x] Light theme + responsive layout (50/50 split, mobile stack)
- [x] Deployment config (Docker, Vercel, nginx)

### Post-MVP P0
- [x] Vietnam focus (map bounds, 63 tỉnh centroids, sub-national geocoding)
- [x] AI Assistant chatbox (3 LLM providers: OpenRouter/Ollama/MLX, streaming)
- [x] Climate Risk Forecast (Open-Meteo → dengue/HFMD risk, 8 provinces, 14-day)
- [x] Case Report Form (6 diseases, 63 tỉnh, localStorage queue)
- [x] Map time filter (24h/7d/30d/All)
- [x] High-res vector basemap (OpenFreeMap bright)
- [x] LLM data pipeline (auto disease name normalization, entity extraction)

### Data & Analytics
- [x] IndexedDB snapshot persistence (30-day retention, survives reload)
- [x] Trend calculator (time-series per disease, stats delta, fastest-growing ranking)
- [x] LLM-enhanced news dedup (Jaccard rule-based + LLM tier 2 for ambiguous pairs)
- [x] Disease normalization: 67 aliases EN+VN, 100% coverage (was 29%)
- [x] Entity extraction: batch ALL items (was only first 5)

### Map Intelligence
- [x] District-level GeoJSON boundaries (708 quận/huyện, geoBoundaries ADM2)
- [x] District choropleth layer (fill color by outbreak severity)
- [x] Early warning overlay (climate HIGH + no outbreak → amber markers)
- [x] Alert escalation detection (watch→warning→alert badges)
- [x] District-level sample data (TPHCM: 5 quận, HN: 2 quận)
- [x] 5 map layer toggles: Districts, Markers, Heatmap, Country, Early Warnings

### Intelligence Features
- [x] Breaking news banner (auto-show on ALERT, dismiss 30s)
- [x] Cross-source signal detection (confidence: HIGH/MEDIUM/LOW)
- [x] Province deep dive panel (outbreaks + climate + news per province)
- [x] YouTube video tab in news panel (WHO/CDC/VTV health videos)

### Quality
- [x] 29 E2E tests (Playwright, all pass)
- [x] TypeScript strict mode, Biome lint clean
- [x] Production build ~460KB gzipped
- [x] 58 TS files, 5617 lines code, 26 commits

---

## Next Up — P1 Features

### Offline Mobile + PWA
- [ ] Service worker for offline caching
- [ ] PWA manifest (installable on mobile)
- [ ] Case report sync queue (IndexedDB → server when online)
- [ ] Responsive mobile layout optimization

### Vector Control Ops Board
- [ ] Map overlay: cases → spray schedules → effectiveness
- [ ] District-level view for field teams
- [ ] Status tracking: sprayed/pending/overdue

### Lab Integration Module
- [ ] Specimen → case → result linking
- [ ] Turnaround time dashboard
- [ ] Alert nếu result pending >5 ngày

### Crowdsourced Symptom Reports
- [ ] Public web form cho phụ huynh/người dân
- [ ] "Unverified" flag until clinical confirmation
- [ ] Community heatmap vs confirmed cases

---

## Future — P2 Features

### Wastewater Surveillance
- [ ] Architecture ready cho environmental sample data
- [ ] Dashboard card: pathogen load trends

### AI Translation
- [ ] Vietnamese ↔ English auto-translate
- [ ] Cross-border alert sharing (Lào, Cambodia)

### Advanced Analytics
- [ ] Historical trend comparison (YoY)
- [ ] Seasonal pattern recognition
- [ ] R0 estimation from case data

### Real Data Integration
- [ ] Vietnam HCDC API (khi available)
- [ ] Vietnam NIHE surveillance data
- [ ] WHO GHO OData indicators
- [ ] eCDS Circular 54 export format

---

## Technical Debt

- [ ] app-init.ts at 200+ lines → extract data-fetch orchestrator
- [ ] case-report-panel.ts at 207 lines → monitor, don't split further
- [ ] Add unit tests (currently E2E only)
- [ ] API edge functions need real deployment testing (Vercel)
- [ ] OpenRouter API key settings UI panel

---

## Metrics Snapshot (2026-04-04 final)

| Metric | Value |
|--------|-------|
| TypeScript files | 58 |
| Total TS lines | 5,617 |
| CSS files | 7 |
| Panels | 10 |
| Map layers | 5 (districts, markers, heatmap, country, early warnings) |
| Data sources | 11 (9 RSS/CSV + 1 weather + 1 GeoJSON) |
| District boundaries | 708 (geoBoundaries VNM ADM2) |
| Disease aliases | 67 (EN + VN, 100% coverage) |
| E2E tests | 29 |
| Bundle size | ~460KB gzip |
| LLM providers | 3 (OpenRouter MiniMax M2.7 default) |
| IndexedDB snapshots | 30-day retention |
| Git commits | 26 |

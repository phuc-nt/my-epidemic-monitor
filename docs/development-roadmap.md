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

### Quality
- [x] 15 E2E tests (Playwright, all pass)
- [x] TypeScript strict mode, Biome lint clean
- [x] Production build 455KB gzipped

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

## Metrics Snapshot (2026-04-04)

| Metric | Value |
|--------|-------|
| TypeScript files | 47 |
| Total TS lines | 3,939 |
| CSS lines | 831 |
| Panels | 8 |
| Data sources | 10 (9 RSS/CSV + 1 weather API) |
| E2E tests | 15 |
| Bundle size | 455KB gzip |
| LLM providers | 3 |
| Git commits | 14 |

# Real Data State — Epidemic Monitor (April 2026)

**Status**: 105 outbreak items + 50 news items from real sources. NO sample data in app-init.ts. Full production pipeline active.

---

## Live Data Summary

### Outbreak Sources (105 items)

| Source | Items | Quality | Issues |
|--------|-------|---------|--------|
| **WHO-DON REST API** | 30 | Global signal | No VN-specific data; acts as background |
| **VietnamNet RSS** | 46 | 30% VN-specific | 14 "Lao" items: many health education vs TB outbreaks |
| **Dân Trí RSS** | 15 | 66% VN extraction | Good province detection |
| **VnExpress RSS** | 7 | Low quality | Many health guides vs outbreak news |
| **Tuổi Trẻ RSS** | 5 | High quality | 100% province extraction, best hygiene |
| **Thanh Niên RSS** | 2 | Medium | HTML entities not fully decoded |
| **TOTAL** | **105** | Mixed | Diverse quality; noise/signal varies |

**Key constraint**: No case counts, ward extraction, or death numbers in current display.

### News Sources (50 items)

| Source | Items | Status |
|--------|-------|--------|
| VnExpress | 24 | Active |
| Tuổi Trẻ | 12 | Active |
| Thanh Niên | 8 | Active |
| VietnamNet | 6 | Active |
| WHO News, CDC-EID | 2 (config) | Timeout in dev; works on Vercel |
| **TOTAL** | **50** | Dedup applied |

---

## Data Processing Pipeline

```
VN RSS (6) + WHO-DON REST
    ↓
api/health/v1/outbreaks.ts (Dev Middleware)
    ├─ Parse RSS/XML → extract title, link, pubDate, description
    ├─ Disease keyword matching (20 regex patterns: sốt xuất huyết, covid, etc.)
    ├─ Province extraction (64 VN provinces + diacritics normalization)
    ├─ Alert level heuristics (keywords: tăng, bùng phát, cảnh báo → escalate)
    ├─ Source badge assignment (show feed name: "VietnamNet", "WHO-DON", etc.)
    └─ Returns JSON array with fields: title, link, disease, province, alertLevel, source, pubDate
    ↓
Client-side: llm-data-pipeline.ts
    ├─ Disease name normalization (67 aliases EN+VN → standard names)
    ├─ Outbreak dedup (Jaccard title similarity, 0.4 threshold)
    ├─ Full article content crawl
    │   ├─ crawl4ai (Python, JS-render): extract full text, handle dynamic content
    │   └─ Fallback simple fetch (SSR-friendly) for static HTML
    ├─ LLM entity extraction (background batch):
    │   ├─ Cases, deaths (from article body)
    │   ├─ Ward/district names (match against vietnam-wards-database.ts)
    │   └─ Dates (outbreak start/end)
    └─ News dedup Tier 1 (Jaccard) + Tier 2 (LLM when ambiguous)
    ↓
IndexedDB snapshots (snapshot-store.ts)
    ├─ Save on each refresh (auto-refresh 5 min)
    ├─ Retain 30 days for trend calculation
    └─ Used by TrendChartPanel for delta arrows + historical view
    ↓
UI Panels render
    ├─ DiseaseOutbreaksPanel: item list with source badges
    ├─ NewsFeedPanel: deduped news items
    ├─ Map layers: markers, heatmap, early warning zones
    ├─ ChatPanel: LLM-powered Q&A (inject top 20 outbreaks + news)
    ├─ ClimateAlertsPanel: Open-Meteo forecast + risk scoring
    ├─ CrossSourceSignalsPanel: multi-source outbreak detection
    └─ ProvinceDeepDivePanel: per-province dashboard
```

---

## Known Issues & Gaps (NOT TODO, REAL CONSTRAINTS)

### 1. Cases, Deaths, Districts = 0% (Background Extraction)

**Issue**: Display shows 0 cases, 0 deaths, 0% district extraction.

**Root cause**:
- RSS summaries contain NO case numbers — only narrative descriptions
- crawl4ai must fetch full article HTML, render JS, extract text
- LLM entity extraction must parse text → identify case counts + ward names
- This is background batch processing — not blocking data fetch
- Many crawled articles are HEALTH GUIDES (how to prevent dengue), not outbreak reports
  - → LLM extraction finds healthcare tips "mua bảo hiểm sức khỏe" instead of case counts

**Status**: extraction_service runs, but backlog. Check browser console for batch results.

**Workaround**: Manual article review or improve prompt to filter health guides.

---

### 2. VietnamNet "Lao" Noise (14 items)

**Issue**: 14 items matched on keyword "lao" (tuberculosis).

**Reality**:
- VietnamNet health section includes health education articles: "Cách phòng ngừa lao", "Lao phổi là gì?"
- These are NOT outbreak reports — just educational content
- No way to auto-distinguish without LLM semantic analysis (too slow for real-time)

**Workaround**: Filter by disease + source + keyword context in UI, or mark category as "educational".

---

### 3. Vietnamese News URLs Expire (1-2 days)

**Issue**: Clicking "Detail" link on 3-day-old news → 404 or redirect.

**Reality**: VN news sites rotate/remove URLs within 1-2 days for bandwidth/SEO.

**Workaround**: Cache article content on first fetch (via article-content-fetcher.ts). Show cached snapshot in detail view instead of live link.

---

### 4. WHO/CDC Timeout (Dev Middleware)

**Issue**: In dev (localhost:5173), WHO-DON and CDC-EID endpoints timeout.

**Reality**:
- Dev middleware has rate-limiting or network conditions
- WHO-DON REST API: `https://www.who.int/api/news/diseaseoutbreaknews` flaky in dev
- CDC-EID: configured but rarely completes

**Status**: 
- CONFIGURED in `api/health/v1/outbreaks.ts` and `api/health/v1/news.ts`
- WORKS on Vercel Edge Functions (production)
- DEV workaround: Use VN RSS sources (105 items sufficient for MVP)

---

### 5. Climate Data: 5/8 Provinces (3 Timeout)

**Issue**: ClimateAlertsPanel shows forecast for only 5 of 8 provinces.

**Root cause**: Open-Meteo API timeouts for some provinces in dev.

**Provinces returning data**: HN, ĐN, TPHCM, Cần Thơ, Đà Lạt (5/8).

**Workaround**: Increase timeout threshold or use fallback coordinates.

---

### 6. Thanh Niên HTML Entities Not Decoded

**Issue**: News from Thanh Niên shows `&quot;` instead of `"`, `&apos;` instead of `'`.

**Root cause**: RSS parser doesn't fully decode HTML entities in description field.

**Workaround**: Add HTML entity decoder in news parsing (simple regex or DOMParser).

---

### 7. Chat Quality Variance

| Provider | Model | Quality | Cost |
|----------|-------|---------|------|
| **OpenRouter** | MiniMax M2.7 | High (accurate, 80K context) | Paid API |
| **Ollama** | gemma3:4b | Low (hallucinates ward names) | Free, local |
| **MLX** | Gemma 4 | Medium | Free, Apple Silicon only |

**Recommendation**: Default to minimax m2.7 (OpenRouter). Set localStorage key: `epidemic-monitor-openrouter-api-key`.

---

## File Structure (Real Implementation)

```
src/
├── app/
│   ├── app-init.ts           # Bootstrap: mounts panels, fetches live data (NO sample data)
│   ├── app-context.ts        # Global state: outbreaks, news, trends
│   ├── app-layout.ts         # DOM grid layout
│
├── data/
│   └── vietnam-wards-database.ts  # 100+ wards: HN, ĐN, TPHCM, southern provinces
│
├── services/
│   ├── disease-outbreak-service.ts        # Calls api/health/v1/outbreaks.ts
│   ├── news-feed-service.ts              # Calls api/health/v1/news.ts
│   ├── llm-data-pipeline.ts              # Disease norm, entity extract, dedup
│   ├── llm-entity-extraction-service.ts  # LLM batch: cases, deaths, wards, dates
│   ├── article-content-fetcher.ts        # crawl4ai + fallback fetch
│   ├── youtube-transcript-service.ts     # Caption extraction
│   ├── cross-source-signal-service.ts    # Multi-source matching
│   ├── llm-router.ts                     # Auto-detect LLM provider
│   ├── llm-provider-openrouter.ts        # OpenRouter adapter
│   ├── llm-provider-ollama.ts            # Ollama adapter
│   ├── llm-provider-mlx.ts               # MLX adapter
│   ├── llm-sse-stream-reader.ts          # Shared SSE parser
│   ├── llm-context-builder.ts            # System prompt injection
│   ├── climate-service.ts                # Open-Meteo + risk scoring
│   ├── snapshot-store.ts                 # IndexedDB 30-day storage
│   ├── trend-calculator.ts               # Delta + escalation detection
│   ├── news-dedup-rules.ts               # Jaccard dedup
│   └── fetch-cache.ts                    # Stale-while-revalidate
│
├── components/
│   ├── disease-outbreaks-panel.ts        # List 105 items with source badges
│   ├── epidemic-statistics-panel.ts      # Aggregate stats
│   ├── news-feed-panel.ts                # 50 deduped news items
│   ├── chat-panel.ts                     # LLM-powered Q&A
│   ├── climate-alerts-panel.ts           # Weather forecast + risk
│   ├── case-report-panel.ts              # Form to report new cases
│   ├── country-health-panel.ts           # OWID COVID data
│   ├── trend-chart-panel.ts              # 30-day trend with deltas
│   ├── cross-source-signals-panel.ts     # Multi-source detection
│   ├── province-deep-dive-panel.ts       # Per-province view
│   ├── breaking-news-banner.ts           # ALERT outbreaks banner
│   ├── map-shell.ts                      # MapLibre GL + deck.gl
│   ├── map-layers/
│   │   ├── index.ts
│   │   ├── scatterplot-layer.ts          # Outbreak markers
│   │   ├── heatmap-layer.ts              # Case density
│   │   ├── choropleth-layer.ts           # District risk map
│   │   └── early-warning-layer.ts        # Climate risk zones
│   └── map-popup.ts                      # Click detail popup
│
├── types/
│   └── index.ts                          # DiseaseOutbreakItem, NewsItem, etc.
│
└── styles/
    └── *.css                             # Light theme (5 files)

api/health/v1/
├── outbreaks.ts              # VN RSS (6) + WHO-DON REST → disease/province/alert
├── news.ts                   # Dedup 6 news feeds
├── climate.ts                # Open-Meteo forecast
├── stats.ts                  # Aggregate from outbreaks
├── countries.ts              # Group outbreaks by country
└── owid.ts                   # COVID-19 global stats (future: TrendPanel)

scripts/
└── crawl-article.py          # crawl4ai wrapper (Python)
```

---

## Testing & Deployment

**Tests**: 15 Playwright E2E tests (verify panels render, data loads, etc.)

```bash
npm run test:e2e      # Run tests
npm run build         # Production build (455KB gzip)
npm run dev           # Dev with Vite + Edge Functions
```

**Deploy**:
```bash
npx vercel              # Deploy to Vercel (Edge Functions + CDN)
docker compose up -d    # Docker: nginx + static app
```

---

## Monitoring & Maintenance

### Data Quality Dashboard

Check real-time stats:
- Total outbreaks fetched: `ctx.outbreaks.length` (browser console)
- News items: `ctx.news.length`
- Snapshot count: IndexedDB (30-day window)
- LLM extraction progress: console logs from `llm-data-pipeline.ts`

### Alert Checklist

| Issue | Check | Fix |
|-------|-------|-----|
| Cases/deaths stuck at 0 | Browser console: entity extraction errors? | Improve prompt or increase timeout |
| News 404 links | Verify article-content-fetcher cache | Enable caching for old articles |
| Climate partial data | Check Open-Meteo API status | Extend timeout or use fewer provinces |
| WHO-DON missing | Verify DNS/network in dev | Use VN RSS only or deploy to Vercel |
| LLM unavailable | Check provider ping (Ollama/OpenRouter) | Set OpenRouter API key in localStorage |

---

## Next Steps (Not Urgent)

- [ ] Improve entity extraction prompt to filter health guides
- [ ] Implement article content cache (persistent storage)
- [ ] Add ward-level geocoding (LLM → match against coordinates)
- [ ] Increase climate timeout or use offline fallback
- [ ] Monitor VN RSS feed stability (log dead feeds)
- [ ] Add "Data Quality" badge per item (0-100% confidence)

---

## References

- [Data Sources Catalog](./data-sources-catalog.md)
- [System Architecture](./system-architecture.md)
- [AI Features Guide](./ai-features-guide.md)
- [Live app](https://epidemic-monitor.vercel.app)

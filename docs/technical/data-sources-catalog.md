# Data Sources Catalog — Epidemic Monitor

Real-time epidemic data pipeline: 105 outbreak items + 50 news items from 13 live sources (NO sample data).

---

## Summary: Real Data Sources (105 + 50 items)

| Category | Source | Items | Type | Status |
|----------|--------|-------|------|--------|
| **OUTBREAKS (105)** | WHO-DON | 30 | REST API | Active |
| | VietnamNet | 46 | RSS | Active |
| | Dân Trí | 15 | RSS | Active |
| | VnExpress | 7 | RSS | Active |
| | Tuổi Trẻ | 5 | RSS | Active |
| | Thanh Niên | 2 | RSS | Active |
| **NEWS (50)** | VnExpress | 24 | RSS | Active |
| | Tuổi Trẻ | 12 | RSS | Active |
| | Thanh Niên | 8 | RSS | Active |
| | VietnamNet | 6 | RSS | Active |
| | WHO, CDC-EID | 2 | REST | Configured (dev timeout) |
| **CLIMATE** | Open-Meteo | 14-day forecast, 8 VN provinces | REST/JSON | Active (5/8 provinces) |
| **STATIC** | geoBoundaries | 708 districts + ward DB (100+ wards HN/ĐN/TPHCM) | GeoJSON | Active |

---

## Outbreak Sources (105 total items)

### 1. WHO-DON (Global, REST API) — 30 items

- **URL**: `https://www.who.int/api/news/diseaseoutbreaknews`
- **Format**: REST JSON (not RSS)
- **Files**: `api/health/v1/outbreaks.ts` → `src/services/disease-outbreak-service.ts`
- **Data**: Global outbreak alerts (Nipah, Marburg, Ebola, MERS, etc.) — NO Vietnam-specific
- **Parse**: JSON items → title, link, pubDate, description
- **Processing**:
  - Extract disease + country from title (pattern: "Disease - Country")
  - Alert level: "outbreak"/"emergency" → alert, "update" → warning, else → watch
  - Geocode: country → ISO code → centroid lat/lng
  - VN sub-national: grep 63 tỉnh names in description → assign VN provinces
- **Problem**: WHO-DON has global outbreaks, low VN overlap. Acts as background signal.

### 2. Vietnamese News RSS (6 sources, 75 items)

| Source | URL | Items | Quality | Notes |
|--------|-----|-------|---------|-------|
| **VietnamNet** | `vietnamnet.vn/suc-khoe.rss` | 46 | 30% VN | Diverse diseases; 14 "Lao" items (many health guides not TB outbreaks) |
| **Dân Trí** | `dantri.com.vn/rss/suc-khoe.rss` | 15 | 66% VN | Best province extraction |
| **VnExpress** | `vnexpress.net/rss/suc-khoe.rss` | 7 | Low | Many health guides vs outbreak news |
| **Tuổi Trẻ** | `tuoitre.vn/rss/suc-khoe.rss` | 5 | High | 100% province extraction, highest quality |
| **Thanh Niên** | `thanhnien.vn/rss/suc-khoe.rss` | 2 | Medium | HTML entities not fully decoded |

**Processing pipeline**:
- Parse RSS → extract title, link, pubDate, description, source name
- Disease matching: 20 regex patterns (VN + EN) — e.g., "sốt xuất huyết|dengue|dengue fever"
- Province extraction: 64 VN provinces + diacritics normalization
- Alert level heuristics: keywords in description (tăng, bùng phát, cảnh báo) → escalate
- Source badge: show feed name on UI item
- **Known issue**: URLs expire within 1-2 days (404/redirect for old articles)

---

## News Sources (50 total items, configured not active in dev)

Files: `api/health/v1/news.ts` → `src/services/news-feed-service.ts`

| Source | URL | Focus | Status | Notes |
|--------|-----|-------|--------|-------|
| VnExpress | RSS | Health | Active | 24 items |
| Tuổi Trẻ | RSS | Health | Active | 12 items (high quality) |
| Thanh Niên | RSS | Health | Active | 8 items |
| VietnamNet | RSS | Health | Active | 6 items |
| WHO News | RSS | Global health | Configured | Timeout in dev |
| CDC-EID | REST API | Global EID | Configured | Timeout in dev |

**Processing**:
- Parse RSS/XML → title, link, pubDate, description
- Strip HTML tags
- Deduplicate (Tier 1: Jaccard similarity 0.4, Tier 2: LLM when ambiguous)
- Mark duplicates as `category: 'duplicate'`
- **Known issue**: WHO/CDC timeout in dev middleware; configured for production

---

---

## Climate Source

**Open-Meteo API**
- **URL**: REST API (14-day forecast)
- **File**: `api/health/v1/climate.ts` → `src/services/climate-service.ts`
- **Data**: Weather 14 days for 8 VN provinces (temp, humidity, rainfall) → risk scoring
- **Coverage**: HN, ĐN, TPHCM, Cần Thơ, Đà Lạt, etc.
- **Issue**: Only 5/8 provinces returning data; 3 may timeout
- **Risk models**: Dengue risk (temp 25-28°C + humidity 80%+) + HFMD (similar)

---

## Static Data

**geoBoundaries + Ward Database**
- **Districts**: 708 boundary polygons (geoBoundaries VNM ADM2)
- **Ward DB**: 100+ wards in HN, ĐN, TPHCM, southern provinces
- **File**: `src/data/vietnam-wards-database.ts`
- **Use**: Ward/district extraction in LLM entity pipeline

---

## Data Pipeline (Client-side)

```
RSS Feeds (6 VN) + WHO-DON REST
    ↓
Dev Middleware (Vite dev server)
    ├→ Disease keyword matching (20 regex)
    ├→ Province extraction (64 provinces)
    ├→ Alert level refinement (keywords)
    ↓
Client: LLM Data Pipeline
    ├→ Disease name normalization (67 aliases EN+VN)
    ├→ Outbreak dedup (Jaccard 0.4 threshold)
    ├→ Full article crawl (crawl4ai JS-render OR simple fetch SSR)
    ├→ Entity extraction (LLM: cases, deaths, ward/district, dates)
    ├→ News dedup Tier 1 (Jaccard) → Tier 2 (LLM when ambiguous)
    ↓
IndexedDB snapshots (5-min auto-refresh, 30-day retention)
    ↓
UI Panels (DiseaseOutbreaksPanel, NewsFeedPanel, etc.)
```

**Processing files**:
- `api/health/v1/outbreaks.ts` — VN RSS + WHO-DON parse
- `api/health/v1/news.ts` — RSS dedup
- `src/services/llm-data-pipeline.ts` — disease norm, entity extract, news dedup
- `src/services/article-content-fetcher.ts` — full article HTML → text
- `src/services/llm-entity-extraction-service.ts` — LLM extraction (cases, deaths, ward)
- `src/services/youtube-transcript-service.ts` — caption fetch

---

## Known Issues & Gaps

| Issue | Impact | Root Cause | Workaround |
|-------|--------|-----------|-----------|
| **Cases = 0%** | Case counts missing | RSS summaries lack case numbers; crawl4ai + LLM background extraction still running | Many articles are health guides not outbreak reports |
| **District = 0%** | Ward extraction fails | Ward DB exists but LLM enrichment needs processing time | Manual verification in DB entries |
| **VietnamNet "Lao"** | 14 noisy items | Many health education vs TB outbreaks | Filter by keywords or mark category |
| **News URLs expire** | 404 links within 1-2 days | Vietnamese news sites rotate URLs | Cache article content on first fetch |
| **WHO/CDC timeout** | International signals missing in dev | Dev middleware rate-limits or times out | Works on production (Vercel Edge) |
| **Thanh Niên entities** | HTML entities not decoded | RSS encoding issue | Manual entity decode in parser |
| **Climate 3/8 timeout** | Missing provinces | API latency or timeout | Fallback to available provinces |
| **Chat quality** | Hallucinations with Ollama | Model capability (gemma3:4b light) | Use minimax m2.7 via OpenRouter for accuracy |

---

## Notes
- All sources **free, no API key required** (except OpenRouter for LLM)
- NO sample data in production — 100% real data
- 5-minute auto-refresh + manual refresh button
- IndexedDB snapshots retained 30 days for trend calculation
- Dev middleware handles RSS parsing to avoid client-side CORS

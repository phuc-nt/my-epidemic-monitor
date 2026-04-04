# Pipeline Baseline — Pre Phase 1 Enrichment (2026-04-05)

> Snapshot kiến trúc & xử lý dữ liệu TRƯỚC khi triển khai Phase 1 (article enrichment theo `solutions/data-enrichment-pipeline.md`). Dùng để so sánh sau khi merge Phase 1.

**Commit tham chiếu:** `4205687` (main)
**Audit source:** `plans/reports/Explore-260405-0627-crawl-pipeline-audit.md`

---

## Tổng quan

App chạy client-side, poll RSS cache qua edge functions. **Không có crawl nền định kỳ**, không LLM extraction cho pipeline. Tier 1 xong, Tier 2-3 chỉ có khung code.

## 1. Cơ chế refresh hiện tại

| Cơ chế | Vị trí | Hành vi |
|---|---|---|
| App poll | `src/app/app-init.ts:245-247` | `setInterval` 5min → re-fetch `/api/health/v1/*` |
| News panel poll | `src/components/news-feed-panel.ts:96-100` | `setInterval` 15min → `fetchHealthNews()` |
| Manual refresh | `src/app/app-init.ts:232-242` | Nút user, re-fetch RSS |
| Vercel Cron | `vercel.json` | **KHÔNG CÓ** — chỉ rewrite + cache headers |
| Scheduler backend | — | **KHÔNG CÓ** |

→ Chỉ poll cache RSS, không crawl bài gốc.

## 2. Pipeline 3-tier — trạng thái thực tế

### Tier 1: RSS Ingestion ✅
- **Edge fn:** `api/health/v1/news.ts`, `api/health/v1/outbreaks.ts`
- **Dev:** `dev-api-middleware.ts`
- **Nguồn VN:** VnExpress, VietnamNet, Tuổi Trẻ, Thanh Niên, Dân Trí
- **Nguồn quốc tế:** WHO-DON (REST), CDC-EID, ECDC, ReliefWeb, WHO-VN
- **Filter:** disease keywords trên RSS
- **Cache TTL:** news 15min, outbreaks 10min (`_cache.ts`)

### Tier 2: Deep Crawl (Crawl4AI) ⚠️ Dev-only
- **File:** `scripts/crawl-article.py` (66 LOC, `AsyncWebCrawler`)
- Xử lý JS-heavy (DanTri, VietnamNet)
- Output: markdown (max 8KB) + plain text (max 5KB)
- **Hạn chế:** cần Python env ngoài (`/tmp/crawl4ai-env`), không chạy trên Vercel Edge, không auto-trigger, không cache DB

### Tier 3: LLM Extraction ⚠️ Rules-only cho data pipeline
- **Files:** `src/services/llm-entity-extraction-service.ts`, `llm-provider-openrouter.ts` (default `minimax/minimax-m2.7`), `llm-data-pipeline.ts`
- **Đang chạy:** regex extraction (cases/deaths tiếng Việt), dedup Jaccard 0.4, disease normalization
- **Chưa chạy:** `extractEntitiesLLM()` tồn tại nhưng không gọi cho news items; không extract JSON structured; không district/ward
- LLM chỉ dùng cho chat, không phải enrichment

## 3. Luồng dữ liệu hiện tại

```
User load app
  ↓
app-init.ts → fetchAllData()
  ├─ /api/health/v1/outbreaks → RSS fetch + regex filter + cache 10min
  ├─ /api/health/v1/stats
  └─ /api/health/v1/news → RSS fetch + filter + cache 15min
  ↓
llm-data-pipeline.ts → processOutbreaks()
  ├─ Rule-based disease normalization
  ├─ Title Jaccard dedup (0.4)
  └─ [NO LLM CALL]
  ↓
Render panels (deck.gl map, news feed, stats)
```

## 4. Gap so với design doc

| Feature (spec) | Thực tế |
|---|---|
| Periodic crawl scheduler | ❌ |
| Crawl4AI production | ⚠️ dev-only script |
| Article markdown cache (tránh 404) | ❌ |
| LLM JSON extraction (M2.7) | ❌ |
| Cases/deaths từ LLM | ❌ (regex only) |
| District extraction | ❌ (province keyword) |
| HCDC/NIHE scraping | ❌ |
| YouTube pipeline | ⚠️ transcript service dev |
| Cross-source signal detection | ✅ (`cross-source-signal-service.ts`) |

## 5. File list chính (baseline)

| File | LOC | Vai trò |
|---|---|---|
| `src/app/app-init.ts` | 385 | Bootstrap + refresh timers |
| `api/health/v1/outbreaks.ts` | 402 | RSS → outbreaks |
| `api/health/v1/news.ts` | 142 | RSS → news |
| `src/services/llm-data-pipeline.ts` | 300+ | Post-fetch processing (rules) |
| `src/services/llm-entity-extraction-service.ts` | 200+ | Entity extraction (rules + LLM stub) |
| `src/services/cross-source-signal-service.ts` | 150+ | Multi-source signal |
| `scripts/crawl-article.py` | 66 | Crawl4AI wrapper |
| `dev-api-middleware.ts` | 450+ | Dev RSS fetcher |

## 6. Kế hoạch Phase 1 (sẽ thay baseline này)

Xem `plans/260405-0629-article-enrichment-phase1/plan.md`. Quyết định runtime: **Node + `@mozilla/readability` + `jsdom`** thay Crawl4AI microservice (YAGNI — báo VN server-rendered). Giữ `crawl-article.py` cho dev/fallback.

6 phase: crawler API → KV cache → M2.7 server-side extraction → Vercel cron 1h → pipeline wire-up → dashboard surface fields.

---

## Unresolved (baseline)

1. Vercel KV vs Blob vs filesystem — chưa quyết
2. Outbreak `id` stability — chưa audit
3. `scripts/crawl-article.py` có bao giờ chạy production? (grep chỉ thấy dev middleware)

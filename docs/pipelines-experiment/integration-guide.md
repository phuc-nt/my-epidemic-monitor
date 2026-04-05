# Integration Guide — Pipelines → my-epidemic-monitor

> **Status (2026-04-05)**: Pipeline side **DONE** (SQLite live, 42 items, cron 12h). App side cần build webhook + merge logic — xem [integration-todo.md](./integration-todo.md) để làm.

---

## 1. Schema Mapping

Output của `extract-m27.py` → `DiseaseOutbreakItem` (`src/types/index.ts`):

| Pipeline field | `DiseaseOutbreakItem` field | Transform |
|---|---|---|
| `disease` | `disease` | normalized EN (db-store.py đã làm) |
| `province` | `province` | canonical 63 tỉnh + lat/lng từ PROVINCE_COORDS |
| `district` | `district` | direct |
| `cases` | `cases` | int, null → omit |
| `cases_type` | — (extra meta) | "cumulative"/"outbreak" — useful for UI |
| `deaths` | `deaths` | int, null → omit |
| `severity` | `alertLevel` | `outbreak→alert`, `warning→warning`, `watch→watch` (đã mapped trong DB) |
| `summary_vi` | `summary` | direct |
| `url` | `url` | direct |
| `source` | `source` | format "web:tuoitre.vn", "youtube:youtu.be", "facebook:facebook.com" |
| `published_at` | `publishedAt` | unix ms |
| `id` | `id` | `md5(url)[:16]` — stable hash |
| — | `country` / `countryCode` | hardcode "Vietnam" / "VN" |
| `confidence` | `meta.confidence` | pipeline-only, not in base type |

Schema đã match hoàn toàn — không cần transform nặng.

---

## 2. Integration Approach: Cron → Webhook → KV

Approach được chọn (Option C — cron pre-ingestion):

```
Mac Mini (cron 12h) — DONE
  └─ run-all.sh → web + youtube + facebook pipelines
       ↓
  SQLite outbreak_items (province validated, deduped, conf ≥ 0.5)
       ↓
  db-export.py → DiseaseOutbreakItem[] JSON    ← DONE
       ↓
  db-sync.sh POST /api/pipeline-webhook        ← TODO (build script Mac Mini side)
       ↓
  Vercel KV key="pipeline:latest" TTL=24h      ← TODO (enable + build webhook)
       ↓
  /api/health/v1/outbreaks.ts merge KV + RSS   ← TODO (~10 LoC add)
```

**Tại sao approach này**: Crawl4AI (Playwright) và MLX Whisper không thể chạy trên Vercel Edge Runtime. Pre-ingest từ Mac Mini và cache vào KV là cách đơn giản nhất — không cần microservice, không cần Python trên Vercel.

---

## 3. Merge với Existing Sources

Trong `api/health/v1/outbreaks.ts`:

```typescript
import { kv } from '@vercel/kv';

// Existing: WHO-DON + VN RSS feeds
const rssOutbreaks = await fetchRssOutbreaks();

// NEW: fetch pipeline snapshot from KV
const snapshot = await kv.get<{ outbreaks: DiseaseOutbreakItem[] }>('pipeline:latest');
const pipelineOutbreaks = snapshot?.outbreaks ?? [];

// Merge — existing dedup logic (Jaccard 0.4 + hashString) handles duplicates
const allOutbreaks = [...rssOutbreaks, ...pipelineOutbreaks];
const deduped = dedupByTitleSimilarity(allOutbreaks, 0.4); // existing fn in llm-data-pipeline.ts
```

Dedup tự chạy qua `processOutbreaks()` trong `src/services/llm-data-pipeline.ts` — pipeline items tự được xử lý.

---

## 4. Edge Runtime Compatibility

| Component | Edge Compatible |
|---|---|
| `@vercel/kv` (fetch KV) | ✅ |
| OpenRouter fetch (M2.7) | ✅ |
| Merge + dedup logic | ✅ |
| Crawl4AI (Playwright) | ❌ — Mac Mini only |
| MLX Whisper | ❌ — Mac Mini only |
| Google SERP scraping | ❌ — Crawl4AI |

---

## 5. Deployment Sequence

1. **Enable Vercel KV**: `vercel kv create epidemic-pipeline-cache` → auto-injects `KV_REST_API_URL`, `KV_REST_API_TOKEN`
2. **Build webhook** (`api/pipeline-webhook.ts`, ~50 LoC) — code mẫu trong [integration-todo.md](./integration-todo.md) Task 2
3. **Build `db-sync.sh`** on Mac Mini side (curl webhook sau cron)
4. **Update `api/health/v1/outbreaks.ts`** merge KV (~10 LoC) — code mẫu trong [integration-todo.md](./integration-todo.md) Task 3
5. **First sync test**: gọi webhook thủ công với sample payload
6. Monitor 24h via `/api/admin/pipeline-status`

**Total effort**: 2–4h.

---

## 6. API Contract (Mac Mini → App)

### Request

```http
POST /api/pipeline-webhook
Authorization: Bearer <PIPELINE_SYNC_TOKEN>
Content-Type: application/json

{
  "exportedAt": 1775350259005,
  "windowHours": 24,
  "minConfidence": 0.5,
  "count": 9,
  "outbreaks": [ /* DiseaseOutbreakItem[] */ ]
}
```

### Response

```json
{ "ok": true, "received": 9, "stored": 9, "rejected": 0 }
```

**Env vars needed**: `PIPELINE_SYNC_TOKEN` (random 32-char, shared with Mac Mini). Generate: `openssl rand -hex 32`.

---

## 7. Testing Checklist

- [ ] `POST /api/pipeline-webhook` với valid token → 200
- [ ] 401 với wrong token
- [ ] 400 với malformed JSON
- [ ] `kv get pipeline:latest` trả đúng data
- [ ] `/api/health/v1/outbreaks` merge + trả pipeline items
- [ ] Dedup: cùng outbreak từ RSS + pipeline → 1 item
- [ ] (Optional) UI badge hiển thị source type

---

## 8. Cost Estimate

| Resource | Monthly |
|---|---|
| M2.7 extraction (5 keywords × 4 runs/day) | ~$30 |
| Gemini Flash Lite (FB vision screenshots) | ~$7 |
| MLX Whisper (Mac, Metal GPU) | $0 |
| YouTube Data API (free tier) | $0 |
| Vercel KV (free tier 30K cmd/mo) | $0 |
| **Total** | **~$37/tháng** |

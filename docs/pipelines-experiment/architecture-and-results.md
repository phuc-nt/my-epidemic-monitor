# Architecture & Results

> **Status (2026-04-05)**: Pipeline hoạt động, SQLite live với 42 items, cron 6h. Sẵn sàng để app consume qua webhook sync.

## System Diagram

```
┌───────────────┐  ┌───────────────┐  ┌──────────────────────────────┐
│ Pipeline WEB  │  │ Pipeline YT   │  │ Pipeline FB (2 modes)        │
│               │  │               │  │                              │
│ Google SERP   │  │ YouTube Data  │  │ [Vision] Playwright → pages  │
│ tbs=qdr:d3    │  │ API search    │  │  CDC, MOH, hospital pages    │
│ site:X        │  │ --after=3d    │  │  Gemini Flash Lite vision    │
│    ↓          │  │    ↓          │  │                              │
│ URL extract + │  │ get video_ids │  │ [Search] FB search keyword   │
│ slug filter   │  │    ↓          │  │  Playwright → screenshots    │
│    ↓          │  │ MLX Whisper   │  │  Gemini Flash Lite vision    │
│ crawl4ai      │  │ transcript VI │  │                              │
│ (--fit md)    │  │               │  │ 8 pages + 6 VN keywords      │
│ site:X        │  │ --after=3d    │  │ tbs=qdr:d3    │
│    ↓          │  │    ↓          │  │    ↓          │
│ URL extract + │  │ get video_ids │  │ URL extract   │
│ slug filter   │  │    ↓          │  │    ↓          │
│    ↓          │  │ MLX Whisper   │  │ crawl4ai      │
│ crawl4ai      │  │ transcript VI │  │ (--fit)       │
│ (--fit md)    │  │               │  │               │
└──────┬────────┘  └──────┬────────┘  └──────┬───────────────────────┘
       │                  │                  │
       └─────────┬────────┴──────────────────┘
                 ▼
       ┌──────────────────────┐
       │  extract-m27.py      │
       │  - clean_markdown()  │
       │  - MiniMax M2.7      │
       │  - JSON object mode  │
       │  + cases_type field  │
       └──────┬───────────────┘
              ▼
       ┌──────────────────────┐
       │  db-store.py         │
       │  - province validate │  ← 63 tỉnh chuẩn + normalize
       │  - non-human filter  │  ← ASF, avian-flu blocked
       │  - Jaccard dedup 0.6 │
       │  - confidence ≥ 0.5  │
       └──────┬───────────────┘
              ▼
       ┌──────────────────────┐
       │  SQLite DB           │
       │  outbreak_items      │  42 items (2026-04-05)
       │  + hotspots VIEW     │  daily disease+province agg
       │  + pipeline_runs     │
       └──────────────────────┘
              ▼ (cron 6h)
       db-export.py → db-sync.sh → POST /api/pipeline-webhook
              ▼
       my-epidemic-monitor (Vercel KV)
```

---

## DB Schema

**Path**: `~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db`

### `outbreak_items` — raw items (1 item = 1 article/post/video)

Matches `DiseaseOutbreakItem` in `src/types/index.ts` plus pipeline metadata:

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | `md5(url)[:16]` |
| disease | TEXT | normalized EN: dengue, hand-foot-mouth... |
| alert_level | TEXT | alert / warning / watch |
| title, summary, url | TEXT | |
| published_at | INTEGER | unix ms |
| lat, lng | REAL | from PROVINCE_COORDS |
| cases | INTEGER | null if not mentioned |
| cases_type | TEXT | **cumulative** / **outbreak** / unknown |
| deaths | INTEGER | |
| province | TEXT | canonical VN name (63 tỉnh + "Toàn quốc") |
| district | TEXT | quận/huyện |
| source | TEXT | e.g. "web:tuoitre.vn", "youtube:youtu.be" |
| source_type | TEXT | web / youtube / facebook |
| confidence | REAL | 0.0–1.0 LLM confidence |
| keyword_used | TEXT | keyword that triggered pipeline |
| ingested_at | INTEGER | unix ms |
| pipeline_version | TEXT | "web-v2", "fb-vision", "fb-search" |

### `hotspots` VIEW — daily aggregation per disease+province

```sql
SELECT disease, province, day, peak_alert, peak_cases, article_count, source_types, source_urls
FROM hotspots WHERE day = date('now') ORDER BY peak_alert DESC;
```

Dùng VIEW này cho app "điểm nóng theo ngày". Excludes african-swine-fever, avian-influenza.

### `pipeline_runs` — audit trail

Logs mỗi pipeline run với: keyword, pipeline, items_stored, items_duplicated, errors.

---

## Data Quality Rules (db-store.py)

1. **Non-human filter**: `african-swine-fever`, `avian-influenza` → reject (hard-coded)
2. **Province validator**: Only accept 63 tỉnh/thành chuẩn + "Toàn quốc". Reject "ĐBSCL", "phía Nam", v.v. Items without valid province + no cases → reject
3. **Confidence gate**: `confidence < 0.5` → reject (configurable via `MIN_CONFIDENCE` env)
4. **Dedup**: hash(url) exact match + Jaccard 0.6 title similarity (30-day window)
5. **cases_type**: M2.7 now extracts "cumulative" vs "outbreak" distinction

---

## Iterations & Fixes

### WEB Pipeline

#### v1 — Native site search (❌ 0 items)

**Approach**: Gọi trực tiếp search URL của 3 site.

| Site | URL | Kết quả |
|------|-----|---------|
| tuoitre.vn | `/tim-kiem.htm?keywords=...` | Works nhưng search theo relevance, không date |
| kenh14.vn | `/tim-kiem.chn?keyword=...` | Works nhưng regex extract bắt nhầm sidebar/feed URLs (79 URLs, 90% noise) |
| vnexpress.net | `/tim-kiem?q=...` | HTTP 406 (Not Acceptable) — blocked |

**Issue chính**: 
- Regex `https://kenh14\.vn/[a-z0-9\-]+-215\d+\.chn` bắt tất cả URLs trên page (menu "sport", "food" v.v.) → 15 articles crawled → 0 outbreak items (tất cả unrelated).
- Tuoi Tre trả article cũ nhất từ 2025 (search by relevance).
- VnExpress block crawl4ai UA.

#### v2 — Google SERP với `tbs=qdr:d3` (✅ 4 items)

**Approach**: Dùng Google Search `site:X "keyword" tbs=qdr:d3` cho cả 3 sites.

```bash
crawl-web.py multi \
  "https://www.google.com/search?q=site:tuoitre.vn+tay+chan+mieng&tbs=qdr:d3&num=20" \
  "https://www.google.com/search?q=site:vnexpress.net+tay+chan+mieng&tbs=qdr:d3&num=20" \
  "https://www.google.com/search?q=site:kenh14.vn+tay+chan+mieng&tbs=qdr:d3&num=20"
```

**Post-filter**: Slug keyword tokens.
```python
# Strip diacritics from keyword, split tokens >= 3 chars
# "tay chân miệng" → ["tay", "chan", "mieng"]
# Only keep URLs where slug contains >=1 token
```

**Kết quả**: 11 URLs qua filter → 4 outbreak items. Province detected, nhưng **cases=None** trong hầu hết → pain point.

#### v3 — Clean markdown boilerplate (✅ 6 items với full cases)

**Root cause**: Tuoi Tre article có 4658 words nhưng 1500 chars đầu tiên toàn navigation links. M2.7 cap 8000 chars → mất article body.

**Fix** (in `extract-m27.py`):
```python
def clean_markdown(md: str) -> str:
    """Strip nav/menu boilerplate: drop lines mostly [](links) or ![](images)."""
    for line in lines:
        link_chars = sum(1 for c in line if c in "[]()")
        if link_chars / len(line) > 0.15:  # >15% là bracket chars
            continue
        if line.startswith(("* [", "![", "[")):
            continue
```

**Impact**: Cases `None` → thực số:
| Site | Trước v3 | Sau v3 |
|------|----------|--------|
| Khánh Hòa article | `cases: null` | `cases: 1400` |
| TP.HCM article | `cases: null` | `cases: 9107` |
| VnExpress national | `cases: null` | `cases: 25000, deaths: 8` |

---

### YouTube Pipeline

#### v1 — Một version, không cần iterate

```bash
search-videos.sh "sốt xuất huyết" --limit 10 --order date --after "2026-04-02"
# → 10 videos
# → get-transcript.sh cho từng video_id (MLX Whisper VN)
# → extract-m27.py
```

**Results**: 8/10 transcripts non-empty, 2 items được M2.7 xác định outbreak news. 6 videos bị skip là awareness shorts (`#chill #yeucuocsong` tags).

**Quality**: conf 0.85-0.90, có district (Cao Lãnh), có case numbers (23, 101).

**Strength**: Transcripts rất detailed (news broadcasters nêu số liệu rõ ràng).

---

### Facebook Pipeline

#### v1 — Google SERP workaround (❌ deprecated)

FB native search require login. Workaround: `site:facebook.com` qua Google. **Vấn đề**: FB posts được crawl qua Google cache → nội dung cũ/thiếu, cases thường `None`.

#### v2 — Playwright + Gemini Vision (✅ production)

Hai scripts mới, cả hai dùng persistent Playwright session (`~/.openclaw/common-scripts/facebook/.browser-data`):

**`fb-page-vision.py`** — scrape FB pages của cơ quan y tế:
```
8 trang: HCDC TP.HCM, Bộ Y Tế, CDC Quảng Nam, CDC Sơn La,
         CDC Đồng Nai, Báo Sức Khỏe, Phòng khám Nhi Đồng, CDC Đà Nẵng
```
- Scroll feed → 4 frame screenshots/page
- Gemini 2.5 Flash Lite vision → extract posts với `date_abs` (YYYY-MM-DD), `post_url`, `text`
- Relative date → absolute: "3h trước" → today, "hôm qua" → yesterday (anchored bằng system date)

**`fb-search-vision.py`** — search FB bằng keyword VN:
```
6 keywords: ổ dịch, sốt xuất huyết, tay chân miệng, dịch sởi, thủy đậu dịch, quai bị dịch
```
- Dùng Most Recent filter (`filters=eyJyZWNlbnRfcG9zdHMi...`)
- 4 frames × 6 keywords → 15 posts max/keyword, filter-days=3
- Dedup by text[:200]

**Results** (2026-04-05 run): 6 keywords → 30 posts → M2.7 → 2 outbreak items stored:
| Disease | Province | Cases | cases_type | Source |
|---------|----------|-------|-----------|--------|
| hand-foot-mouth | Toàn quốc | 25,094 | cumulative | facebook:search |
| dengue | Toàn quốc | 32,000 | cumulative | facebook:search |

Note: FB pages toàn đăng nội dung "Ngày Sức Khỏe 7/4" hôm nay → 0 items từ page vision. Expected.

---

## Current DB State (2026-04-05)

**42 items** across 3 source types:

| source_type | items | diseases | provinces |
|-------------|-------|----------|-----------|
| web | 30 | 9 | 14 |
| youtube | 10 | 4 | 2 |
| facebook | 2 | 2 | 1 ("Toàn quốc") |

**Hotspots today** (from `hotspots` VIEW):

| Disease | Province | Peak Alert | Peak Cases | Sources |
|---------|----------|-----------|-----------|---------|
| hand-foot-mouth | Toàn quốc | warning | 25,094 (cumulative) | facebook |
| chickenpox | Đắk Lắk | alert | 40 | youtube |
| hand-foot-mouth | TP.HCM | alert | — | youtube |
| measles | TP.HCM | alert | — | youtube |
| mumps | Đắk Lắk | alert | 17 | youtube |
| dengue | TP.HCM | alert | 13,294 (cumulative) | web |

---

## Sample Results Table (từ experiment ngày đầu)

### Web v3 (keyword: "tay chân miệng")

| # | Disease | Province | Cases | Deaths | Severity | Conf |
|---|---------|----------|-------|--------|----------|------|
| 1 | hand-foot-mouth | Khánh Hòa | 1400 | null | outbreak | 0.95 |
| 2 | hand-foot-mouth | Đà Nẵng | 483 | null | warning | 0.90 |
| 3 | hand-foot-mouth | TP.HCM | 9107 | null | warning | 0.95 |
| 4 | hand-foot-mouth | TP.HCM | null | null | warning | 0.75 |
| 5 | hand-foot-mouth | TP.HCM | 25000 | null | warning | 0.65 |
| 6 | hand-foot-mouth | TP.HCM | null | 8 | outbreak | 0.85 |

### YouTube v1 (keyword: "sốt xuất huyết")

| # | Disease | Province | District | Cases | Date | Conf |
|---|---------|----------|----------|-------|------|------|
| 1 | dengue | Thanh Hóa | null | 23 | null | 0.85 |
| 2 | dengue | Đồng Tháp | Cao Lãnh | 101 | 2026-04-04 | 0.90 |

### Facebook v1 (keyword: "sốt xuất huyết")

| # | Disease | Province | Cases | Conf | Note |
|---|---------|----------|-------|------|------|
| 1 | dengue | TP.HCM | null | 0.30 | HCDC official |
| 2 | dengue | Hải Dương | null | 0.70 | Hospital page |
| 3 | hand-foot-mouth | Cần Thơ | null | 0.75 | Thanh Niên FB |

---

## Key Insights

1. **Google SERP `tbs=qdr:d3`** là cách tốt nhất để enforce 3-day window cho web VN.
2. **`clean_markdown()` là critical** cho báo VN vì article body deep bên trong nav boilerplate.
3. **MLX Whisper transcript VN chất lượng tốt** — news broadcasters đọc rõ số liệu.
4. **Playwright + Gemini Vision cho Facebook** — hiệu quả hơn SERP workaround, lấy được date_abs và post_url trực tiếp.
5. **M2.7 `is_outbreak_news`** guard tốt (~40-50% reject), nhưng cần hard-filter thêm bên db-store.py cho non-human diseases.
6. **Province validator là cần thiết** — LLM trả "ĐBSCL", "phía Nam" → phải normalize/reject trước khi lưu.
7. **`cases_type` (cumulative vs outbreak)** quan trọng cho UX: 25,094 ca TCM là số lũy kế cả nước, không phải ổ dịch mới.
8. **FB CDC pages** hay đăng health awareness content (không phải outbreak news) → yield thấp vào ngày đặc biệt. FB search keyword yield tốt hơn.

---

## Sample Outputs

3 file JSON sample đã lưu trong `sample-outputs/`:
- `web-tay-chan-mieng.json` — 6 items
- `youtube-sot-xuat-huyet.json` — 2 items  
- `facebook-sot-xuat-huyet.json` — 3 items

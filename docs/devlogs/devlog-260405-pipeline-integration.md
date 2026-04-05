# Devlog 2026-04-05 — Pipeline Integration & Product Repositioning

## Tổng quan

Tích hợp data pipeline từ Mac Mini vào Vercel app. Định vị lại sản phẩm: không cạnh tranh với thống kê nhà nước, chỉ quét news đa nguồn → tổng hợp điểm nóng theo ngày (mỗi 6h).

**Commits hôm nay**: 11 commits  
**Thay đổi chính**: pipeline integration, Vietnamese names, docs restructure, bidirectional map-list, Mac Mini as sole source

---

## Timeline

### 14:00 — Định vị lại sản phẩm

Repo này (`my-epidemic-monitor`) **chỉ hiển thị data** — không crawl, không extract.  
Bên crawl/extract/DB là `openclaw` chạy trên Mac Mini (repo riêng).

**Luồng mới:**
```
Mac Mini (openclaw) → SQLite → db-api-server.py:8742 → Cloudflare Tunnel → Vercel API → UI
```

### 14:10 — Mac Mini Pipeline Setup

**`openclaw` pipeline** (`epidemic-monitor-pipeline`) chạy mỗi 6h qua launchd:
- Crawl: VnExpress, VietnamNet, Tuổi Trẻ, Thanh Niên, Dân Trí, YouTube
- Extract: LLM → disease/province/cases/severity
- Store: SQLite tại `~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db`
- 42 items live trong DB khi bắt đầu tích hợp

**`db-api-server.py`** (FastAPI trên port 8742):
- `GET /health` — no auth
- `GET /hotspots?day=YYYY-MM-DD` — `X-Api-Key` header
- `GET /outbreaks` — `X-Api-Key` header

**launchd plist** fix: python path sai (`/Users/phucnt/.openclaw/venv/bin/python3` không tồn tại) → sửa thành `/opt/homebrew/bin/python3`. Load thành công, server auto-start khi boot.

### 14:20 — fetchPipelineHotspots() trong Production API

Thêm vào `api/health/v1/outbreaks.ts`:
- Đọc `EPIDEMIC_API_URL` + `EPIDEMIC_API_KEY` từ env vars
- Fetch `/hotspots?day=TODAY` với timeout 10s
- Map response → `DiseaseOutbreakItem` (id hash, alertLevel, title, cases...)
- Graceful fallback: trả `[]` nếu env vars absent hoặc server down
- Merge với WHO DON qua `Promise.allSettled`

### 14:30 — Dev Middleware Update

`dev-api-middleware.ts` có `handleOutbreaks()` riêng không gọi pipeline. Fix:
1. Load `.env.local` vào `process.env` tại module load (Vite không expose tự động cho middleware)
2. Thêm `fetchPipelineHotspots()` mirror logic production API
3. Merge pipeline items vào `Promise.allSettled` cùng WHO DON

### 14:40 — Cloudflare Tunnel

Quick tunnel: `cloudflared tunnel --url http://localhost:8742`  
→ Temporary public HTTPS URL (`*.trycloudflare.com`), thay đổi mỗi lần restart.

Add vào `.env.local` (dev) và Vercel dashboard (production):
- `EPIDEMIC_API_URL=https://transmit-consultation-coming-productivity.trycloudflare.com`
- `EPIDEMIC_API_KEY=a8c7c...`

**Known issue**: URL thay đổi khi Mac Mini restart hoặc tunnel restart. Cần persistent tunnel dài hạn.

### 15:00 — Kết quả End-to-End

**Production** (`project-abbbd.vercel.app`): 115 outbreaks, 6 pipeline items  
**Dev** (`localhost:5173`): 104 outbreaks, 6 pipeline items

Pipeline items live:
| Disease | Tỉnh | Cases | Source |
|---------|------|-------|--------|
| chickenpox | Đắk Lắk | 40 | youtube |
| hand-foot-mouth | TP.HCM | N/A | youtube |
| measles | TP.HCM | N/A | youtube |
| mumps | Đắk Lắk | 17 | youtube |

### 15:30 — Vietnamese Disease Names

**Vấn đề**: DB lưu English slugs (`chickenpox`, `hand-foot-mouth`, `mumps`...).  
UI render raw slug → user thấy tiếng Anh.

**Đây là UI issue**, không phải DB issue. Fix 3 chỗ:

1. `case-report-panel-data.ts` — thêm slugs mới vào `DISEASES` list:
   - `chickenpox → Thủy đậu`
   - `hand-foot-mouth → Tay chân miệng (HFMD)`
   - `mumps → Quai bị`
   - `rabies → Dại (Rabies)`
   - `meningitis → Viêm màng não`
   - `covid-19 → COVID-19`

2. `disease-outbreaks-panel.ts` — dùng `diseaseLabel(item.disease)` thay raw slug khi render

3. `app-init.ts` — dùng `diseaseLabel(top.disease)` trong breaking news banner

### 16:00 — Bidirectional Map-List Linking

Map marker click → filter outbreak list theo province (chip hiển thị, có nút ×).  
List row click → map flyTo + highlight province markers (dim các markers khác).

Sự kiện mới:
- `map-marker-clicked` (map→list, tránh vòng lặp với `outbreak-selected`)
- `province-filter-changed` (chip clear → sync map highlight)

deck.gl `updateTriggers` cho reactive province highlight (alpha dim/enlarge).

### 16:10 — Mac Mini Pipeline as Sole Source

**Refactor lớn:** loại bỏ WHO DON + VN RSS khỏi `outbreaks.ts`.

**Vấn đề trước:** `outbreaks.ts` 441 lines, merge WHO DON + 5 VN RSS feeds + pipeline.  
**Sau:** 120 lines, chỉ gọi Mac Mini `/hotspots`.

**Root cause Vercel build failure:** `@/` alias không resolve được trong Edge Function bundler.  
Fix: tạo `api/_disease-labels.ts` (no `@/` import) thay vì import từ `src/`.

**`news.ts`:** gọi Mac Mini `/news` primary, fallback 3 RSS nếu offline.

### 16:30 — Phân chia nhiệm vụ Mac Mini vs Vercel

Tạo `docs/technical/data-source-division.md`:
- Bảng phân chia rõ ai làm gì
- Spec endpoint `/news` cho Mac Mini team implement
- Contract disease slug + province name format

### 17:10 — Vietnamese Province Names Fix

Pipeline trả tên tiếng Việt có dấu (`Đắk Lắk`, `TP.HCM`...).  
Lookup table `VN_PROVINCES` chỉ có EN → lat/lng về Vietnam centroid.

Fix: thêm Vietnamese names + regional terms (`Toàn quốc`, `phía Nam`, `ĐBSCL`).

**Kết quả sau fix:**
- `Đắk Lắk` → `lat=12.71, lng=108.24` ✅
- `TP.HCM` → `lat=10.82, lng=106.63` ✅
- `Toàn quốc` → Vietnam centroid ✅

### 15:45 — Docs Restructure

Xóa các thư mục không còn cần thiết:
- `docs/pipelines-experiment/` — scripts thực đã ở Mac Mini (repo openclaw), không cần giữ bản sao
- `docs/research/` — market research one-off, đã lỗi thời
- `docs/solutions/` — pipeline giờ là external service, không còn "solution" để implement

Merge nội dung hữu ích vào `technical/system-architecture.md` và `technical/data-sources-catalog.md`.

Chuyển `development-roadmap.md` → `docs/technical/`.

**Cấu trúc mới:**
```
docs/
├── README.md
├── devlogs/
├── product/
│   └── product-introduction.md
└── technical/
    ├── system-architecture.md   (cập nhật dual-source arch)
    ├── data-sources-catalog.md
    ├── ai-features-guide.md
    └── development-roadmap.md
```

---

## Kiến trúc cuối ngày

```
┌─────────────────────────────────────────────┐
│                Mac Mini                      │
│  epidemic-monitor-pipeline (6h cron)        │
│  Crawl web/YT/FB → LLM extract → SQLite     │
│  db-api-server.py :8742 (FastAPI)           │
│  GET /hotspots?day=  GET /news?limit=       │
└─────────────────┬───────────────────────────┘
                  │ Cloudflare Tunnel (HTTPS)
                  ↓
┌─────────────────────────────────────────────┐
│  Vercel — thin proxy + cache                │
│  outbreaks.ts → /hotspots (sole source)     │
│  news.ts      → /news (fallback: RSS)       │
│  climate.ts   → Open-Meteo                  │
└─────────────────────────────────────────────┘
```

---

## Metrics tích lũy

| Metric | Giá trị |
|--------|---------|
| Data sources active | Mac Mini pipeline (sole source) + Open-Meteo |
| Pipeline items (live) | 6 hotspots (4 bệnh: Thủy đậu/HFMD/Sởi/Quai bị) |
| Total outbreaks shown | 6 (pipeline only, không còn WHO/RSS noise) |
| outbreaks.ts lines | 441 → 120 (−73%) |
| E2E tests | 29 pass |
| TypeScript files | 59+ |
| Git commits (total) | 36+ |

---

## Quyết định thiết kế

1. **Display-only repo** — không crawl, không LLM extract trong repo này. Data từ external pipeline.
2. **Mac Mini = sole source** — loại bỏ WHO DON + RSS khỏi Vercel. Tín hiệu rõ hơn, không còn noise từ 5 RSS feeds.
3. **Graceful degradation** — pipeline down → outbreaks trả `[]`, news fallback về RSS, không crash.
4. **`@/` alias không work trong Vercel Edge bundler** — dùng relative imports trong `api/`, extract shared code ra `api/_*.ts`.
5. **English slugs trong DB** — normalize ở UI layer (`diseaseLabel()`), không sửa DB.
6. **Quick Cloudflare Tunnel** — đủ cho dev/demo. Persistent tunnel cần thiết khi có user thật.

---

## Pending

- [ ] Persistent Cloudflare tunnel — URL thay đổi khi restart. Cần `cloudflared tunnel create` với named tunnel.
- [ ] Cập nhật `EPIDEMIC_API_URL` trên Vercel mỗi khi tunnel restart (tạm thời)
- [ ] Mac Mini implement `GET /news?limit=50` → Vercel tự switch từ RSS fallback sang pipeline news
- [ ] Thêm more news sources vào pipeline (hiện chủ yếu YouTube)

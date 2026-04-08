<p align="center">
  <img src="assets/logo.svg" alt="Epidemic Monitor logo" width="220" />
</p>

<h1 align="center">Epidemic Monitor</h1>

<p align="center">
  <em>Phát hiện sớm điểm nóng dịch bệnh ở Việt Nam — từ báo chí, YouTube và mạng xã hội, gom lại thành một bản đồ duy nhất.</em>
</p>

<p align="center">
  <a href="https://epidemic-monitor.pages.dev"><strong>🌐 Mở app</strong></a> ·
  <a href="product-docs/"><strong>📖 Product docs</strong></a> ·
  <a href="docs/"><strong>🛠 Tài liệu kỹ thuật</strong></a> ·
  <a href="https://github.com/phuc-nt/epidemic-monitor-pipeline"><strong>⚙️ Pipeline repo</strong></a>
</p>

---

## Câu chuyện đằng sau

Mỗi năm, phụ huynh có con nhỏ ở Việt Nam đều phải đối mặt với cùng một nỗi lo: **mùa dịch lại tới**. Sốt xuất huyết tháng 7. Tay chân miệng tháng 9. Sởi, cúm, ho gà rải rác cả năm. Khi tin về một ổ dịch ở trường mầm non bên cạnh xuất hiện, thường là đã quá trễ để phòng tránh.

Báo cáo của Bộ Y tế và CDC tỉnh là nguồn chính thống, nhưng thường chậm vài ngày tới vài tuần. Trong khoảng thời gian đó, **báo chí và mạng xã hội đã viết về ổ dịch từ lâu rồi**. Vấn đề là không ai có thời gian đọc hết các nguồn này mỗi ngày.

Epidemic Monitor đọc giùm bạn — quét báo chí Việt Nam, YouTube và Facebook mỗi 6 giờ, dùng AI lọc tin dịch thật, đưa lên một bản đồ Việt Nam duy nhất. Mở app là dùng được, không đăng ký, miễn phí.

## Bạn thấy được gì

| Tính năng | Mô tả |
|-----------|-------|
| 🗺 **Bản đồ ổ dịch** | Marker theo tỉnh/huyện cho từng ổ dịch đang hoạt động trong 30 ngày qua |
| 📋 **Panel ổ dịch** | Danh sách thẻ với bệnh + tỉnh/huyện + số ca + mức cảnh báo + link nguồn |
| 📰 **Dòng tin tức** | 50 tin mới nhất từ các báo lớn (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí…) |
| 📊 **Thống kê tổng quan** | Tổng số ổ dịch, số tỉnh ảnh hưởng, top bệnh đang nóng |
| 🤖 **AI Chat** | Hỏi tự nhiên: *"Hà Nội tuần này có dịch gì?"*, *"Tay chân miệng đang lan ở những tỉnh nào?"* |
| 🌡 **Cảnh báo khí hậu** | Dự báo nguy cơ dengue/HFMD theo tỉnh, dựa trên nhiệt độ + độ ẩm + mưa |
| 📍 **Chế độ huyện** | Marker chính xác đến cấp huyện khi báo có nhắc, cho field team |
| 🚨 **Breaking news** | Banner đỏ cho cảnh báo cao, tự ẩn sau 30s |

Xem [product-docs](product-docs/) để biết chi tiết về từng tính năng.

## Quick Start (developer)

```bash
npm install
npm run dev
# → http://localhost:5173
```

App tự động fetch dữ liệu từ Cloudflare D1 (production) hoặc dev middleware (local). Không cần setup database.

### Build cho production

```bash
npm run build
npx wrangler pages deploy dist --project-name epidemic-monitor
# → https://epidemic-monitor.pages.dev
```

Auto-deploy được kích hoạt qua Cloudflare Pages GitHub integration: mỗi push lên `main` sẽ trigger build + deploy tự động.

## Kiến trúc tóm tắt

```
┌─────────────────────────────────────────────────────────┐
│  Pipeline (epidemic-monitor-pipeline repo, Mac Mini)    │
│                                                          │
│  Báo VN + YouTube + Facebook                            │
│         ↓ (mỗi 6h, AI lọc + extract)                    │
│  SQLite local → Cloudflare D1 (delta sync + retry)      │
└────────────────────┬────────────────────────────────────┘
                     │ D1 native binding (zero hop)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  my-epidemic-monitor (this repo, Cloudflare Pages)      │
│                                                          │
│  Pages Functions: /api/health/v1/all + chat + climate   │
│  In-memory cache 10-min TTL, origin protection          │
│                     ↓                                    │
│  Vanilla TS + Vite + deck.gl + MapLibre GL              │
│  Bản đồ + 10 panels (modular, self-contained)           │
└─────────────────────────────────────────────────────────┘
```

**Tách biệt rõ ràng**:
- Repo này (`my-epidemic-monitor`) — chỉ frontend + Pages Functions, **display-only**, không crawl/extract
- Repo pipeline ([epidemic-monitor-pipeline](https://github.com/phuc-nt/epidemic-monitor-pipeline)) — chạy trên Mac Mini, đẩy data lên D1

→ Frontend không phụ thuộc Mac Mini uptime. Mac Mini có offline thì D1 vẫn còn data, app vẫn chạy bình thường.

## Tech Stack

| Lớp | Lựa chọn |
|-----|----------|
| Framework | Vanilla TypeScript (không React/Vue) — bundle nhỏ ~80KB gzipped trừ deck.gl |
| Build | Vite |
| Bản đồ | MapLibre GL (vector tiles) + deck.gl (WebGL layers) |
| API | Cloudflare Pages Functions với D1 native binding |
| Database | Cloudflare D1 (APAC region) |
| AI/LLM | OpenRouter (MiniMax M2.7), OpenAI-compatible — swap provider không đổi code |
| Climate | Open-Meteo (free, không cần key) |
| Test | Playwright E2E (29 tests) |
| Lint | Biome |
| Deploy | Cloudflare Pages (auto-deploy on push) |

## Cấu trúc thư mục

```
src/
├── app/              # AppContext, layout, init bootstrap
├── components/       # 10 panels + map shell + layers
├── services/         # 13 services (data, LLM, climate…)
├── types/            # TypeScript interfaces
├── utils/            # DOM, sanitize, storage, sparkline
└── styles/           # Light theme CSS

functions/api/health/v1/   # Cloudflare Pages Functions
  ├── all.ts               # Bulk endpoint (outbreaks + stats + news)
  ├── chat.ts              # AI chat proxy với origin + rate limit
  ├── climate.ts           # Open-Meteo proxy
  └── _middleware.ts       # Origin protection cho mọi /api/*

product-docs/        # Tài liệu cho người dùng cuối (Jekyll + just-the-docs)
docs/                # Tài liệu nội bộ — kỹ thuật, devlogs, research
e2e/                 # 29 Playwright tests
assets/              # Logo + tài nguyên
```

## Tài liệu

### Cho người dùng cuối

| Page | Nội dung |
|------|----------|
| [product-docs/index.md](product-docs/index.md) | Trang chủ — câu chuyện đằng sau |
| [product-docs/why.md](product-docs/why.md) | Vì sao có dự án này |
| [product-docs/core-features.md](product-docs/core-features.md) | 10 tính năng chính |

### Cho developer

Tài liệu kỹ thuật chi tiết (kiến trúc, AI features, devlog, roadmap) sống trong workspace nội bộ và không có trong repo public này. Để hiểu nhanh, đọc:

- Section **Kiến trúc tóm tắt** ở trên
- Code comments trong [src/app/app-init.ts](src/app/app-init.ts) (bootstrap logic)
- [functions/api/health/v1/all.ts](functions/api/health/v1/all.ts) (bulk endpoint + cache strategy)
- [functions/_middleware.ts](functions/_middleware.ts) (origin protection)

## Test

```bash
npm run test:e2e      # 29 Playwright E2E tests
npm run typecheck     # TypeScript strict mode
npm run lint          # Biome lint
npm run build         # Production build
```

## Trạng thái dự án

- **Live tại**: [epidemic-monitor.pages.dev](https://epidemic-monitor.pages.dev)
- **Cập nhật dữ liệu**: mỗi 6 giờ (qua pipeline trên Mac Mini)
- **Lưu trữ**: 30 ngày gần nhất (auto-cleanup)
- **Filter**: chỉ ổ dịch ở Việt Nam (VN-only filter ở 2 lớp LLM + DB)
- **Frontend**: Vanilla TS, không vendor lock-in
- **Backend**: True serverless edge — D1 native binding, không Worker proxy hop

## License

AGPL-3.0 — Non-commercial use. Xem [LICENSE](LICENSE).

## Tác giả

[@phuc-nt](https://github.com/phuc-nt) — Một dự án cá nhân, làm vì *vấn đề có thật* mà tác giả muốn giải quyết cho chính gia đình mình.

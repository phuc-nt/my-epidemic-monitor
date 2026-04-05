# Epidemic Pipelines — Integration Docs

> **Nguồn**: OpenClaw (Mac Mini local) — research pipelines thu thập tin dịch bệnh VN từ web báo + YouTube + Facebook.
> **Status (2026-04-05)**: Pipeline side **DONE** — 42 items in SQLite, cron 6h/lần, data sẵn sàng. Chỉ còn build webhook + merge bên app.

---

## Đọc theo thứ tự này để integrate

### Bước 1 — Hiểu mình cần làm gì (15 phút)

**[integration-todo.md](integration-todo.md)** ← **Bắt đầu tại đây**

Liệt kê đúng 4 tasks cần làm bên my-epidemic-monitor. Pipeline + DB bên Mac Mini đã xong. Bên này chỉ cần:
1. Enable Vercel KV
2. Build `/api/pipeline-webhook` (~50 LoC TypeScript)
3. Merge data vào `/api/health/v1/outbreaks.ts` (~10 LoC)
4. UI badge cho pipeline sources (optional)

---

### Bước 2 — Hiểu data đến như thế nào (10 phút)

**[architecture-and-results.md](architecture-and-results.md)**

- Full system diagram: Mac Mini cron → SQLite → db-sync.sh → webhook → Vercel KV → app
- DB schema (`outbreak_items`, `hotspots` VIEW, `pipeline_runs`)
- Data quality rules: province validator, non-human filter, cases_type
- Current DB state: 42 items (30 web, 10 youtube, 2 facebook), hotspots today

---

### Bước 3 — Hiểu schema mapping (5 phút)

**[integration-guide.md](integration-guide.md)**

- Field-by-field mapping pipeline JSON → `DiseaseOutbreakItem`
- Các field đã match hoàn toàn (province đã canonical, alertLevel đã mapped, id đã hash)
- Option C pre-ingestion là approach hiện tại (đã implement, cron chạy 6h)
- Cost estimate: ~$37/tháng

---

### Tài liệu tham khảo (đọc khi cần)

| File | Dùng khi |
|------|----------|
| [mac-mini-system.md](mac-mini-system.md) | Cần hiểu Mac Mini side hoạt động thế nào |
| [tools-stack-reference.md](tools-stack-reference.md) | Cần biết tool nào đang dùng (crawl4ai, Whisper, Gemini, M2.7) |
| [scripts/](scripts/) | Cần đọc source code pipeline |
| [sample-outputs/](sample-outputs/) | Cần xem JSON mẫu thực tế |
| [config.json](config.json) | Keywords và config hiện tại của Mac Mini cron |

---

## Tóm tắt flow hiện tại

```
Mac Mini (cron 12h)
  └─ run-all.sh
      ├─ pipeline-web-v2.sh     (keywords, Google SERP tbs=qdr:d3 + crawl4ai)
      ├─ pipeline-youtube-v1.sh (keywords, YouTube Data API + MLX Whisper)
      └─ pipeline-facebook-v1.sh (keywords, Google site:fb.com + crawl4ai)
          ↓ extract-m27.py (MiniMax M2.7 — clean_markdown + JSON extraction)
          ↓ db-store.py (province validate, Jaccard dedup 0.6, confidence ≥ 0.5)
          ↓ SQLite outbreak_items + hotspots VIEW
          ↓ db-sync.sh --since-hours 24         ← cần build (Mac Mini side)
          ↓ POST /api/pipeline-webhook           ← cần build (app side)
          ↓ Vercel KV "pipeline:latest" TTL 24h ← cần enable
          ↓ /api/health/v1/outbreaks.ts          ← cần merge (~10 LoC)
```

---

## Payload từ Mac Mini (shape đã fix, không đổi)

```typescript
// POST /api/pipeline-webhook body
{
  exportedAt: number,        // unix ms
  windowHours: number,       // 24
  minConfidence: number,     // 0.5
  count: number,
  outbreaks: DiseaseOutbreakItem[]  // schema match 100%
}
```

Xem `integration-todo.md` Task 2 để biết `DiseaseOutbreakItem` fields cụ thể trong payload.

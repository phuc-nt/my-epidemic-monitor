# solutions/

Giải pháp thu thập & phân tích dữ liệu dịch bệnh — tận dụng Crawl4AI + MiniMax M2.7 (OpenRouter).

## Tài liệu

| File | Nội dung |
|------|----------|
| [data-enrichment-pipeline.md](data-enrichment-pipeline.md) | Pipeline chính: 3-tier (RSS → Crawl4AI → M2.7 extract), LLM prompt, implementation, cost, roadmap |
| [international-data-sources.md](international-data-sources.md) | 9 nguồn API quốc tế + 3 nguồn VN + YouTube channels, xếp theo priority |

## Tóm tắt Giải pháp

```
RSS Feeds (6 VN + WHO) ─── real-time ──┐
disease.sh API ─────────── real-time ──┤
WHO GHO OData ──────────── quarterly ──┤
ProMED RSS ─────────────── real-time ──┤
YouTube (WHO/VTV24/CDC) ── daily ──────┤
HCDC/NIHE (crawl) ──────── daily ──────┤
                                       ▼
                              ┌──────────────┐
                              │  Crawl4AI    │
                              │  full article │
                              │  + cache     │
                              └──────┬───────┘
                                     ▼
                              ┌──────────────┐
                              │  M2.7 LLM    │
                              │  extraction  │
                              │  ~$3.3/month │
                              └──────┬───────┘
                                     ▼
                              ┌──────────────┐
                              │  Structured  │
                              │  outbreak DB │
                              │  cases,deaths│
                              │  province,   │
                              │  district    │
                              └──────────────┘
```

## Impact ước tính

| Metric | Trước | Sau |
|--------|-------|-----|
| Cases extraction | 0% | ~85% |
| District extraction | 0% | ~70% |
| URL lifespan | 1-2 ngày | Vĩnh viễn (cached) |
| Sources | 7 | 13+ |
| Video sources | 0 | 3 channels |
| Cost | $0 | ~$3.3/tháng |

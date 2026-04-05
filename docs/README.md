# docs/

Project knowledge base — tài liệu sản phẩm, kỹ thuật, nhật ký.

## Cấu trúc

```
docs/
├── product/
│   └── product-introduction.md    # Giới thiệu, vấn đề, giải pháp
│
├── technical/
│   ├── system-architecture.md     # Dual-source arch: WHO + Mac Mini
│   ├── data-sources-catalog.md    # Live sources (WHO, VN RSS, YouTube)
│   ├── ai-features-guide.md       # LLM providers, chat, enrichment
│   └── development-roadmap.md     # P0 completed, P1+ backlog
│
└── devlogs/
    ├── devlog-260404-product-build.md          # MVP + P0 build
    └── devlog-260404-agent-kit-best-practices.md  # MK patterns
```

**Removed (consolidated to technical/):**
- `research/` — archived (one-off research, no longer actionable)
- `solutions/` — merged to data-sources-catalog.md
- `pipelines-experiment/` — reference only; production pipeline on Mac Mini (openclaw repo)

## Architecture Summary

**This repo** (Vercel): Display-only web app
- Fetch WHO-DON via Vercel Edge Functions
- Fetch Mac Mini hotspots via Cloudflare tunnel
- Merge data, render map + panels, AI chat

**Mac Mini** (external `openclaw` repo): Data collection
- Crawl Vietnamese news (6h cron, launchd)
- Extract via MiniMax M2.7, store SQLite
- Expose `/hotspots?day=YYYY-MM-DD` FastAPI

See `technical/system-architecture.md` for detailed diagrams.

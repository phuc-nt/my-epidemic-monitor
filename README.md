# Epidemic Monitor

Dashboard theo dõi dịch bệnh truyền nhiễm tại Việt Nam — sốt xuất huyết, COVID-19, tay chân miệng, cúm, sởi.

Derived from [WorldMonitor](https://github.com/koala73/worldmonitor), stripped down and specialized for Vietnam epidemic surveillance.

## Features

| Feature | Description |
|---------|-------------|
| **Disease Outbreaks** | District-level alerts with severity filter, escalation badges |
| **District Map** | 708 quận/huyện boundaries (geoBoundaries), choropleth by severity |
| **Climate Risk Forecast** | 14-day dengue/HFMD risk for 8 provinces, early warning overlay |
| **AI Assistant** | Chat with data in VN/EN (MiniMax M2.7 / Ollama / MLX streaming) |
| **Case Report Form** | Multi-disease for 63 provinces, offline localStorage queue |
| **Health News** | 7 RSS feeds, LLM-enhanced dedup (Jaccard + MiniMax) |
| **Statistics + Trends** | Delta arrows ↑↓, trend banner, IndexedDB 30-day history |
| **Breaking News** | Red banner for urgent ALERT outbreaks, auto-dismiss 30s |
| **Cross-Source Signals** | Multi-source alignment (WHO+CDC+MOH), confidence scoring |
| **Province Deep Dive** | Per-province dashboard: outbreaks, climate, news, totals |
| **5 Map Layers** | Districts, Markers, Heatmap, Country Risk, Early Warnings |

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). Map centered on Vietnam with REAL outbreak data from 6 Vietnamese RSS feeds + WHO-DON API (105 outbreaks + 50 news items, no sample data).

## Key Info

**Real Data, No Sample Data:** Live feeds from VietnamNet, Dân Trí, VnExpress, Tuổi Trẻ, Thanh Niên, WHO-DON REST API.

**Data Pipeline:**
- 6 Vietnamese RSS sources → parse disease keywords + province extraction
- WHO-DON REST API → global outbreaks with VN geocoding
- LLM entity extraction (background): cases, deaths, ward/district, dates
- News dedup (Jaccard Tier 1 + LLM Tier 2)
- IndexedDB snapshots: 5-min auto-refresh, 30-day retention for trends

**Known Gaps (Real constraints):**
- **Cases/deaths/wards = 0%**: Article content extraction via crawl4ai + LLM still processing; many crawled articles are health guides not outbreaks
- **VietnamNet noise**: 14 "Lao" disease items (health education vs TB outbreaks)
- **URLs expire**: Vietnamese news links rotate 1-2 days (404/redirect)
- **WHO/CDC timeout**: International sources timeout in dev middleware (Vercel Edge works)
- **Climate**: 5/8 provinces returning data (3 may timeout)

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | Vanilla TypeScript, Vite, deck.gl, MapLibre GL |
| Map | OpenFreeMap vector tiles (bright theme) |
| API | Vercel Edge Functions (REST/JSON) |
| AI/LLM | OpenRouter (MiniMax M2.7), Ollama, MLX — OpenAI-compatible |
| Data | WHO DON, CDC, MOH-VN, OWID, Open-Meteo (10 sources) |
| Test | Playwright E2E (15 tests) |
| Deploy | Vercel, Docker + nginx |

## Real Data Sources (105 + 50 items)

| Category | Sources | Items | Update Freq |
|----------|---------|-------|------------|
| **Outbreaks** | WHO-DON REST, VietnamNet, Dân Trí, VnExpress, Tuổi Trẻ, Thanh Niên | 105 | 5 min |
| **News** | 6 VN RSS feeds (WHO, CDC configured but timeout in dev) | 50 | 5 min |
| **Climate** | Open-Meteo 14-day forecast (8 VN provinces) | Variable | 6 hr |
| **Static** | geoBoundaries (708 districts) + Ward DB (100+ wards) | Fixed | Static |

See [docs/technical/data-sources-catalog.md](docs/technical/data-sources-catalog.md) for detailed source breakdown, processing pipeline, and known issues.

## Project Structure

```
src/
├── app/              # AppContext, layout, init bootstrap
├── components/       # 10 panels + map shell + layers
├── services/         # 13 services (data, LLM, climate, reports)
├── types/            # TypeScript interfaces
├── utils/            # DOM, sanitize, storage, sparkline
└── styles/           # Light theme CSS (5 files)
api/health/v1/        # 6 edge functions
e2e/                  # 15 Playwright tests
docs/                 # Product, technical, devlogs, research
```

## Documentation

| Doc | Description |
|-----|-------------|
| [Product Introduction](docs/product/product-introduction.md) | For users + sponsors |
| [System Architecture](docs/technical/system-architecture.md) | Architecture + Mermaid diagrams |
| [Data Sources Catalog](docs/technical/data-sources-catalog.md) | All 10 data sources |
| [Development Roadmap](docs/development-roadmap.md) | Completed + planned features |

## Testing

```bash
npm run test:e2e      # 29 Playwright E2E tests
npm run typecheck     # TypeScript strict mode
npm run lint          # Biome lint
npm run build         # Production build (455KB gzip)
```

## Deployment

### Vercel
```bash
npx vercel
```

### Docker
```bash
docker compose up -d
# → http://localhost:8080
```

## AI Assistant Setup

The AI chatbox auto-detects available LLM providers:

1. **Ollama** (local) — `ollama serve` with gemma3/qwen3/llama3
2. **MLX** (Apple Silicon) — `mlx_lm.server`
3. **OpenRouter** (cloud) — set API key in localStorage: `epidemic-monitor-openrouter-api-key`

## License

AGPL-3.0 — Non-commercial use. See [LICENSE](LICENSE) for details.

---

Built with [my-agent-kit](https://github.com/anthropics/claude-code) orchestration.

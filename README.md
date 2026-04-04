# Epidemic Monitor

Dashboard theo dõi dịch bệnh truyền nhiễm tại Việt Nam — sốt xuất huyết, COVID-19, tay chân miệng, cúm, sởi.

Derived from [WorldMonitor](https://github.com/koala73/worldmonitor), stripped down and specialized for Vietnam epidemic surveillance.

## Features

| Feature | Description |
|---------|-------------|
| **Disease Outbreaks** | 8+ outbreak alerts with severity filter (ALERT/WARNING/WATCH) |
| **Climate Risk Forecast** | 14-day dengue/HFMD risk prediction for 8 provinces via Open-Meteo |
| **Interactive Map** | deck.gl + MapLibre GL — outbreak markers, severity heatmap, time filter |
| **AI Assistant** | Chat with epidemic data in Vietnamese/English (Ollama/OpenRouter/MLX) |
| **Case Report Form** | Multi-disease reporting for 63 provinces, offline localStorage queue |
| **Health News** | 7 RSS feeds: WHO, CDC, MOH-VN, ProMED, ECDC, ReliefWeb |
| **Statistics** | Total outbreaks, active alerts, top diseases |
| **Country Health** | Per-country risk profile + disease list |

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). Map centered on Vietnam with sample outbreak data.

## Screenshots

Map with outbreak heatmap + 8 panels (statistics, climate alerts, news, AI chat, case reporting).

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

## Data Sources

| Source | Data | Cache |
|--------|------|-------|
| WHO DON | Outbreak alerts (RSS) | 5 min |
| WHO-VN | Vietnam health news | 15 min |
| MOH-VN | Bộ Y tế news | 15 min |
| CDC | US health news | 15 min |
| OWID | COVID-19 per country (CSV) | 6 hr |
| Open-Meteo | Weather → dengue/HFMD risk | 6 hr |

See [docs/technical/data-sources-catalog.md](docs/technical/data-sources-catalog.md) for full details.

## Project Structure

```
src/
├── app/              # AppContext, layout, init bootstrap
├── components/       # 8 panels + map shell + layers
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
npm run test:e2e      # 15 Playwright E2E tests
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

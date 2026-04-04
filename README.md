# Epidemic Monitor

Real-time infectious disease monitoring dashboard — track outbreaks of dengue, COVID-19, cholera, influenza, and more.

Derived from [WorldMonitor](https://github.com/koala73/worldmonitor), stripped down to focus exclusively on epidemic surveillance.

## Features

- **Disease Outbreak Tracking** — Real-time data from WHO Disease Outbreak News
- **Interactive Map** — deck.gl + MapLibre GL with outbreak markers, severity heatmap, country risk choropleth
- **Health News Feed** — Aggregated from WHO, CDC, ProMED, ECDC, ReliefWeb
- **Country Health Profiles** — Per-country epidemic status and risk scores
- **Statistics Dashboard** — Case counts, trends, top diseases
- **Dark Theme** — Optimized for monitoring dashboards

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173).

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | TypeScript, Vite, deck.gl, MapLibre GL |
| API | Vercel Edge Functions (REST/JSON) |
| Data Sources | WHO DON, WHO GHO, Our World in Data, CDC, ProMED |
| Deployment | Vercel, Docker, static hosting |

## Data Sources

- **WHO Disease Outbreak News (DON)** — RSS feed for global outbreak alerts
- **WHO Global Health Observatory** — OData API for health statistics
- **Our World in Data** — COVID-19 and infectious disease datasets
- **CDC Newsroom** — US health news
- **ProMED-mail** — Early disease intelligence
- **ECDC** — European disease surveillance

## Deployment

### Vercel

```bash
npm i -g vercel
vercel
```

### Docker

```bash
docker compose up -d
```

Access at [localhost:8080](http://localhost:8080).

## Project Structure

```
src/
├── app/          # App shell, context, layout, bootstrap
├── components/   # Panels, map, layers
├── services/     # Data fetching, caching
├── types/        # TypeScript interfaces
├── utils/        # DOM helpers, sanitization, storage
└── styles/       # CSS (dark theme, responsive)
api/
└── health/v1/    # Edge functions (WHO, OWID proxies)
```

## License

AGPL-3.0 — Non-commercial use. See [LICENSE](LICENSE) for details.

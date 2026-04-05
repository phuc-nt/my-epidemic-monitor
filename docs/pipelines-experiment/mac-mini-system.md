# Mac Mini Pipeline System — Setup & Operations

**Runs on**: Mac Mini (Darwin, Apple Silicon) via OpenClaw cron  
**DB path**: `~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db`  
**Status**: ✅ Live, cron 12h, 42 items in DB

> Architecture, DB schema, quality filters, và tested results → xem [architecture-and-results.md](./architecture-and-results.md).  
> Integration tasks bên app → xem [integration-todo.md](./integration-todo.md).

---

## Components

| Script | Role | I/O |
|---|---|---|
| `pipeline-web-v2.sh` | Google SERP `tbs=qdr:d3` + crawl4ai | keyword, out_dir → `web-v2-extracted.json` |
| `pipeline-youtube-v1.sh` | YouTube Data API search + MLX Whisper transcript | keyword, out_dir → `yt-v1-extracted.json` |
| `pipeline-facebook-v1.sh` | Google `site:fb.com tbs=qdr:d3` + crawl4ai | keyword, out_dir → `fb-v1-extracted.json` |
| `extract-m27.py` | Shared M2.7 extractor + `clean_markdown()` | crawl JSON → extracted JSON |
| `db-init.py` | Create SQLite schema | — |
| `db-store.py` | Insert items (province validate, Jaccard dedup, conf gate) | extracted JSON → DB |
| `db-export.py` | Export rows → `DiseaseOutbreakItem[]` JSON | flags → stdout JSON |
| `run-all.sh` | Orchestrator — loop keywords × pipelines | config.json |

---

## Initial Setup

```bash
# 1. Init DB (one-time)
python3 scripts/db-init.py

# 2. Required env vars
export OPENROUTER_API_KEY="sk-or-v1-..."
export YOUTUBE_API_KEY="..."          # chỉ cần cho YouTube pipeline
export PIPELINE_SYNC_TOKEN="..."      # shared với app webhook
```

Dependencies: `pip install crawl4ai mlx-whisper yt-dlp requests && playwright install chromium`

---

## Usage

```bash
# Run tất cả keywords (từ config.json) × tất cả pipelines
bash scripts/run-all.sh

# Run keyword cụ thể
PIPELINES="web,youtube" bash scripts/run-all.sh "sốt xuất huyết"

# Export JSON để sync lên app
python3 scripts/db-export.py --since-hours 24 --min-conf 0.5 > export.json

# Query DB trực tiếp
sqlite3 ~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db \
  "SELECT disease, province, cases, confidence FROM outbreak_items ORDER BY ingested_at DESC LIMIT 20"
```

---

## Cron Setup (OpenClaw)

Thêm vào `~/.openclaw/cron/jobs.json`:

```json
{
  "name": "epidemic-pipeline-run",
  "schedule": "0 */12 * * *",
  "command": "bash /path/to/scripts/run-all.sh && bash /path/to/scripts/db-sync.sh",
  "timeout": 3600
}
```

`db-sync.sh` (cần tạo) — push snapshot lên app webhook sau mỗi run:

```bash
#!/bin/bash
# db-sync.sh — export + POST to app webhook
python3 scripts/db-export.py --since-hours 24 --min-conf 0.5 \
  | curl -s -X POST "${APP_WEBHOOK_URL}/api/pipeline-webhook" \
      -H "Authorization: Bearer ${PIPELINE_SYNC_TOKEN}" \
      -H "Content-Type: application/json" \
      -d @-
```

---

## Unresolved

1. Dedup cross-keyword chưa test (Jaccard sẽ catch nếu title similar)
2. Google SERP rate limit khi chạy nhiều keywords liên tiếp — cần `sleep 5` giữa các requests
3. Retention cleanup (xóa rows > 30 days) chưa implement
4. Facebook pipeline noise — cần threshold cao hơn hoặc source whitelist
5. Chưa test failure modes: OpenRouter timeout, SERP empty, network disconnect

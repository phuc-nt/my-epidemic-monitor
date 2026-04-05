#!/usr/bin/env python3
"""
db-init.py — Initialize SQLite DB for epidemic pipeline output.

Schema matches my-epidemic-monitor's DiseaseOutbreakItem (src/types/index.ts)
with added pipeline metadata columns.

Usage: db-init.py [db_path]
Default: ~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db
"""
import os, sys, sqlite3

DEFAULT_DB = os.path.expanduser("~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db")

SCHEMA = """
-- Outbreak items (match DiseaseOutbreakItem exactly + pipeline metadata)
CREATE TABLE IF NOT EXISTS outbreak_items (
  id TEXT PRIMARY KEY,              -- hashString(url)
  disease TEXT NOT NULL,            -- normalized EN
  country TEXT DEFAULT 'Vietnam',
  country_code TEXT DEFAULT 'VN',
  alert_level TEXT CHECK(alert_level IN ('alert','warning','watch')),
  title TEXT,
  summary TEXT,
  url TEXT,
  published_at INTEGER,             -- unix ms
  lat REAL,
  lng REAL,
  cases INTEGER,
  deaths INTEGER,
  province TEXT,
  district TEXT,
  source TEXT,                      -- e.g. "web:tuoitre.vn", "youtube:VTV24"
  -- pipeline metadata (not in DiseaseOutbreakItem)
  source_type TEXT,                 -- 'web'|'youtube'|'facebook'
  confidence REAL,                  -- LLM extraction confidence 0.0-1.0
  keyword_used TEXT,                -- keyword that triggered discovery
  ingested_at INTEGER NOT NULL,     -- unix ms when inserted
  pipeline_version TEXT             -- e.g. "web-v2", "youtube-v1"
);

CREATE INDEX IF NOT EXISTS idx_outbreak_disease ON outbreak_items(disease);
CREATE INDEX IF NOT EXISTS idx_outbreak_province ON outbreak_items(province);
CREATE INDEX IF NOT EXISTS idx_outbreak_published ON outbreak_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbreak_ingested ON outbreak_items(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbreak_source_type ON outbreak_items(source_type);

-- Pipeline run history (for monitoring)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  keyword TEXT NOT NULL,
  pipeline TEXT NOT NULL,           -- 'web'|'youtube'|'facebook'
  pipeline_version TEXT,
  items_crawled INTEGER DEFAULT 0,
  items_extracted INTEGER DEFAULT 0, -- passed M2.7 is_outbreak_news
  items_stored INTEGER DEFAULT 0,
  items_duplicated INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_started ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_keyword ON pipeline_runs(keyword);
"""

def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()

    # Report
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    counts = {}
    for (t,) in tables:
        counts[t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    conn.close()

    print(f"[db-init] DB: {db_path}", file=sys.stderr)
    for t, c in counts.items():
        print(f"  {t}: {c} rows", file=sys.stderr)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
db-export.py — Export SQLite rows → DiseaseOutbreakItem[] JSON
(ready to sync to my-epidemic-monitor).

Usage:
  db-export.py [--since-hours N] [--min-conf 0.5] [--limit 200] [db_path]

Output JSON shape:
  {
    "exportedAt": <unix ms>,
    "window_hours": 24,
    "count": <N>,
    "outbreaks": [ DiseaseOutbreakItem, ... ]
  }
"""
import os, sys, json, sqlite3, argparse, time

DEFAULT_DB = os.path.expanduser("~/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since-hours", type=int, default=72, help="Export rows ingested within N hours")
    ap.add_argument("--min-conf", type=float, default=0.5)
    ap.add_argument("--limit", type=int, default=500)
    ap.add_argument("db", nargs="?", default=DEFAULT_DB)
    args = ap.parse_args()

    since_ms = int(time.time() * 1000) - args.since_hours * 3600_000
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("""
        SELECT id, disease, country, country_code, alert_level, title, summary, url,
               published_at, lat, lng, cases, deaths, province, district, source,
               confidence, source_type
        FROM outbreak_items
        WHERE ingested_at >= ? AND confidence >= ?
        ORDER BY published_at DESC
        LIMIT ?
    """, (since_ms, args.min_conf, args.limit)).fetchall()

    outbreaks = []
    for r in rows:
        item = {
            "id": r["id"],
            "disease": r["disease"],
            "country": r["country"],
            "countryCode": r["country_code"],
            "alertLevel": r["alert_level"],
            "title": r["title"],
            "summary": r["summary"],
            "url": r["url"],
            "publishedAt": r["published_at"],
            "source": r["source"],
        }
        # Optional fields
        for db_key, js_key in [("lat","lat"),("lng","lng"),("cases","cases"),("deaths","deaths"),
                                ("province","province"),("district","district")]:
            v = r[db_key]
            if v is not None:
                item[js_key] = v
        # Extension metadata (my-epidemic-monitor can choose to display or ignore)
        item["meta"] = {
            "confidence": r["confidence"],
            "sourceType": r["source_type"],
        }
        outbreaks.append(item)

    out = {
        "exportedAt": int(time.time() * 1000),
        "windowHours": args.since_hours,
        "minConfidence": args.min_conf,
        "count": len(outbreaks),
        "outbreaks": outbreaks,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    conn.close()

if __name__ == "__main__":
    main()

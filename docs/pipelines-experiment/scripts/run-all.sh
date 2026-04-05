#!/usr/bin/env bash
# run-all.sh — Orchestrator: run all pipelines × keywords, store to SQLite
#
# Usage:
#   run-all.sh                             # uses keywords from config.json
#   run-all.sh "kw1" "kw2" "kw3"           # ad-hoc keywords
#   PIPELINES="web,youtube" run-all.sh ...  # subset

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../config.json"
TMP_DIR="/tmp/epidemic-pipeline-$$"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

# Load keywords
if [[ $# -gt 0 ]]; then
  KEYWORDS=("$@")
elif [[ -f "$CONFIG" ]]; then
  mapfile -t KEYWORDS < <(python3 -c "import json;print('\n'.join(json.load(open('$CONFIG'))['keywords']))")
else
  echo "[run-all] No keywords. Provide args or create config.json" >&2
  exit 1
fi

PIPELINES="${PIPELINES:-web,youtube,facebook}"
DB_PATH="${DB_PATH:-$HOME/.openclaw/pipelines/epidemic-monitor/db/epidemic-monitor.db}"

echo "[run-all] Keywords: ${KEYWORDS[*]}" >&2
echo "[run-all] Pipelines: $PIPELINES" >&2
echo "[run-all] DB: $DB_PATH" >&2

# Ensure DB exists
python3 "$SCRIPT_DIR/db-init.py" "$DB_PATH" >/dev/null 2>&1

log_run() {
  local keyword="$1" pipeline="$2" version="$3" started="$4" finished="$5" stats_json="$6" err="${7:-}"
  python3 - "$DB_PATH" "$keyword" "$pipeline" "$version" "$started" "$finished" "$stats_json" "$err" <<'PY'
import sys, sqlite3, json
db, kw, pl, ver, started, finished, stats_json, err = sys.argv[1:]
stats = json.loads(stats_json) if stats_json else {}
conn = sqlite3.connect(db)
conn.execute("""
  INSERT INTO pipeline_runs
    (started_at, finished_at, keyword, pipeline, pipeline_version,
     items_crawled, items_extracted, items_stored, items_duplicated, error)
  VALUES (?,?,?,?,?,?,?,?,?,?)""", (
    int(started), int(finished), kw, pl, ver,
    stats.get("total", 0), stats.get("total", 0),
    stats.get("stored", 0), stats.get("duplicated", 0),
    err or None,
))
conn.commit(); conn.close()
PY
}

run_pipeline() {
  local kw="$1" pipeline="$2"
  local script_file="$SCRIPT_DIR/pipeline-${pipeline}-v1.sh"
  local version="${pipeline}-v1"
  [[ "$pipeline" == "web" ]] && { script_file="$SCRIPT_DIR/pipeline-web-v2.sh"; version="web-v2"; }
  local extracted="$TMP_DIR/${pipeline}-extracted.json"

  echo "" >&2
  echo "=== [$kw] pipeline=$pipeline ===" >&2
  local started=$(($(date +%s) * 1000))
  local err=""
  # Copy extracted output to TMP_DIR after each pipeline run
  local pipeline_out_dir="$TMP_DIR/${pipeline}-out"
  mkdir -p "$pipeline_out_dir"
  if ! bash "$script_file" "$kw" "$pipeline_out_dir" 2>&1 | tail -15; then
    err="pipeline script failed"
  fi
  local finished=$(($(date +%s) * 1000))

  # Find extracted JSON
  local found=$(ls "$pipeline_out_dir"/*extracted.json 2>/dev/null | head -1)
  if [[ -z "$found" ]]; then
    err="${err:-no extracted output}"
    log_run "$kw" "$pipeline" "$version" "$started" "$finished" "{}" "$err"
    return
  fi

  # Store to DB
  local stats=$(python3 "$SCRIPT_DIR/db-store.py" "$found" "$kw" "$version" "$DB_PATH" 2>/dev/null | tail -1)
  log_run "$kw" "$pipeline" "$version" "$started" "$finished" "$stats"
}

IFS=',' read -ra PIPES <<< "$PIPELINES"
for kw in "${KEYWORDS[@]}"; do
  for pl in "${PIPES[@]}"; do
    run_pipeline "$kw" "$pl"
  done
done

# Summary
echo "" >&2
echo "=== Summary ===" >&2
sqlite3 "$DB_PATH" "
  SELECT pipeline, SUM(items_stored) as stored, SUM(items_duplicated) as dup, COUNT(*) as runs
  FROM pipeline_runs WHERE started_at > $(($(date +%s) * 1000 - 3600000))
  GROUP BY pipeline;"
echo "" >&2
echo "Total rows: $(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM outbreak_items')" >&2

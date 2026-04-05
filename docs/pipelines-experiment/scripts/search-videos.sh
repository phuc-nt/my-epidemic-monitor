#!/usr/bin/env bash
# search-videos.sh — Search YouTube videos
# Uses YouTube Data API via youtube.py skill (requires auth)
# Usage: search-videos.sh <query> [--limit 10] [--order date|viewCount|relevance] [--duration short|medium|long] [--after 2026-01-01]
# Output: JSON array from YouTube API

set -euo pipefail

QUERY="${1:?Usage: search-videos.sh <query> [--limit N] [--order ORDER] [--duration DUR] [--after DATE]}"
shift

# Defaults
LIMIT=10
ORDER=""
DURATION=""
AFTER=""

# Parse optional args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --order) ORDER="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --after) AFTER="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Find youtube.py skill
YOUTUBE_PY="$HOME/.openclaw/workspace-daily-digest/skills/youtube-ultimate/scripts/youtube.py"
if [[ ! -f "$YOUTUBE_PY" ]]; then
  echo '{"error": "youtube.py skill not found"}' >&2
  exit 1
fi

# Build command
CMD=(uv run "$YOUTUBE_PY" --json search "$QUERY" -l "$LIMIT")
[[ -n "$ORDER" ]] && CMD+=(-o "$ORDER")
[[ -n "$DURATION" ]] && CMD+=(--duration "$DURATION")
[[ -n "$AFTER" ]] && CMD+=(--published-after "${AFTER}T00:00:00Z")

"${CMD[@]}"

#!/usr/bin/env bash
# get-transcript.sh — Get transcript for a YouTube video via MLX Whisper
#
# Strategy: yt-dlp + MLX Whisper (Metal GPU, offline, any video)
#   Model: mlx-community/whisper-large-v3-turbo (~1.5 GB)
#   Excellent multilingual auto-detection (incl. Vietnamese)
#
# Usage:
#   get-transcript.sh <video_id> [options]
#
# Options:
#   --lang LANG          Language hint, e.g. vi or en (auto-detect if omitted)
#   --timestamps         Include [MM:SS] timestamps
#   --json               Output as JSON

set -euo pipefail

VIDEO_ID="${1:?Usage: get-transcript.sh <video_id> [--lang LANG] [--timestamps] [--json]}"
shift

# ── Defaults ──────────────────────────────────────────────────────────────────
LANG="auto"
TIMESTAMPS=""
JSON_FLAG=""

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang)         LANG="$2"; shift 2 ;;
    --timestamps)   TIMESTAMPS="--timestamps"; shift ;;
    --json)         JSON_FLAG="--json"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── MLX Whisper (Metal GPU, any video) ───────────────────────────────────────
MLX_WHISPER_SH="$SCRIPT_DIR/mlx-whisper-transcribe.sh"
if [[ ! -f "$MLX_WHISPER_SH" ]]; then
  echo "Error: mlx-whisper-transcribe.sh not found at $MLX_WHISPER_SH" >&2
  exit 1
fi

LANG_ARG=""
[[ -n "$LANG" && "$LANG" != "auto" ]] && LANG_ARG="--language $LANG"

# shellcheck disable=SC2086
bash "$MLX_WHISPER_SH" "$VIDEO_ID" \
  $LANG_ARG \
  $TIMESTAMPS \
  $JSON_FLAG

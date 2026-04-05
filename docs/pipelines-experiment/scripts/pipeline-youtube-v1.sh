#!/usr/bin/env bash
# pipeline-youtube-v1.sh — YouTube epidemic pipeline (search + transcript + M2.7)
#
# Usage: pipeline-youtube-v1.sh "<keyword>" [output_dir]

set -euo pipefail
KEYWORD="${1:?keyword required}"
OUT_DIR="${2:-/Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/outputs}"
mkdir -p "$OUT_DIR"

# 3-day window date
AFTER=$(date -v-3d +%Y-%m-%d 2>/dev/null || date -d '-3 days' +%Y-%m-%d)

echo "[yt-v1] Keyword: $KEYWORD | After: $AFTER" >&2

# Step 1: Search videos (after date, order by date)
echo "[yt-v1] Step 1: searching YouTube..." >&2
~/.openclaw/common-scripts/youtube/search-videos.sh "$KEYWORD" \
  --limit 10 --order date --after "$AFTER" \
  > "$OUT_DIR/yt-v1-search.json" 2>/dev/null || {
    echo "[yt-v1] YouTube API search failed — fallback to channel fetch" >&2
  }

# Extract video IDs
python3 - "$OUT_DIR" <<'PY'
import json, sys, os
out_dir = sys.argv[1]
path = f"{out_dir}/yt-v1-search.json"
if not os.path.exists(path) or os.path.getsize(path) == 0:
    json.dump({"video_ids":[], "videos":[]}, open(path.replace('search','video-ids'),'w'))
    print("[yt-v1] no search results", file=sys.stderr); raise SystemExit(0)
d = json.load(open(path))
# Handle different response shapes
if isinstance(d, list):
    items = d
else:
    items = d.get('items') or d.get('results') or []
videos = []
for it in items:
    vid = it.get('id',{}).get('videoId') if isinstance(it.get('id'),dict) else it.get('video_id') or it.get('id')
    sn = it.get('snippet',{}) if 'snippet' in it else it
    videos.append({
        "video_id": vid,
        "title": sn.get('title') or it.get('title',''),
        "channel": sn.get('channelTitle') or it.get('channel',''),
        "published": sn.get('publishedAt') or it.get('published_at',''),
    })
json.dump({"count":len(videos), "videos":videos}, open(f"{out_dir}/yt-v1-video-ids.json","w"), ensure_ascii=False, indent=2)
print(f"[yt-v1] extracted {len(videos)} video ids", file=sys.stderr)
PY

# Step 2: Get transcripts
echo "[yt-v1] Step 2: fetching transcripts..." >&2
python3 - "$OUT_DIR" <<'PY'
import json, subprocess, os, sys
out_dir = sys.argv[1]
d = json.load(open(f"{out_dir}/yt-v1-video-ids.json"))
items = []
for v in d['videos'][:8]:  # cap 8 to control time
    vid = v['video_id']
    if not vid: continue
    print(f"  fetching {vid}: {v['title'][:60]}", file=sys.stderr)
    try:
        r = subprocess.run(
            [os.path.expanduser("~/.openclaw/common-scripts/youtube/get-transcript.sh"), vid, "--lang", "vi"],
            capture_output=True, text=True, timeout=180
        )
        text = r.stdout.strip()
        if len(text) < 50: text = ""
    except Exception as e:
        text = ""; print(f"    err: {e}", file=sys.stderr)
    items.append({
        "url": f"https://youtu.be/{vid}",
        "title": v['title'],
        "channel": v.get('channel'),
        "published": v.get('published'),
        "transcript": text,
        "transcript_len": len(text),
    })
json.dump({"count":len(items), "items":items}, open(f"{out_dir}/yt-v1-transcripts.json","w"), ensure_ascii=False, indent=2)
print(f"[yt-v1] got {sum(1 for i in items if i['transcript_len']>0)} non-empty transcripts", file=sys.stderr)
PY

# Step 3: M2.7 extraction
echo "[yt-v1] Step 3: M2.7 extraction..." >&2
python3 /Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/scripts/extract-m27.py \
  "$OUT_DIR/yt-v1-transcripts.json" \
  "$OUT_DIR/yt-v1-extracted.json" \
  "youtube"

echo "[yt-v1] Done. $OUT_DIR/yt-v1-extracted.json" >&2

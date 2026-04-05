#!/usr/bin/env bash
# pipeline-facebook-v1.sh — FB post pipeline via Google SERP (site:facebook.com)
# then visit via crawl-web.py (uses browser, may need login for some posts)
#
# Usage: pipeline-facebook-v1.sh "<keyword>" [output_dir]

set -euo pipefail
KEYWORD="${1:?keyword required}"
OUT_DIR="${2:-/Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/outputs}"
mkdir -p "$OUT_DIR"

CRAWL="python3 $HOME/.openclaw/common-scripts/research/crawl-web.py"
ENCKEY=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote_plus(sys.argv[1]))" "$KEYWORD")

echo "[fb-v1] Keyword: $KEYWORD" >&2

# Step 1: Google search site:facebook.com with 3-day date filter (tbs=qdr:d3)
echo "[fb-v1] Step 1: Google search site:facebook.com, past 3 days..." >&2
$CRAWL markdown "https://www.google.com/search?q=site:facebook.com+${ENCKEY}&tbs=qdr:d3&num=20" >/dev/null 2>&1
cp /tmp/crawl4ai-result.json "$OUT_DIR/fb-v1-serp.json"

# Step 2: extract FB post URLs
echo "[fb-v1] Step 2: extracting FB URLs..." >&2
python3 - "$OUT_DIR" <<'PY'
import json, re, sys
out_dir = sys.argv[1]
d = json.load(open(f"{out_dir}/fb-v1-serp.json"))
md = d['results'][0].get('markdown','')
# FB post patterns: facebook.com/{page}/posts/{id}, facebook.com/groups/{gid}/posts/{pid},
# facebook.com/{page}/videos/, facebook.com/permalink.php?story_fbid=
urls = set()
for pattern in [
    r'https://(?:www\.)?facebook\.com/[^\s\)]+/posts/[^\s\)\?\&]+',
    r'https://(?:www\.)?facebook\.com/groups/[^\s\)]+/posts/[^\s\)\?\&]+',
    r'https://(?:www\.)?facebook\.com/[^\s\)]+/videos/[^\s\)\?\&]+',
    r'https://(?:www\.)?facebook\.com/permalink\.php\?story_fbid=\d+&id=\d+',
]:
    for m in re.finditer(pattern, md):
        urls.add(m.group(0))
# Clean URLs (strip trailing punctuation)
urls = [u.rstrip(').,;') for u in urls]
urls = sorted(set(urls))
print(f"[fb-v1] found {len(urls)} FB post URLs", file=sys.stderr)
json.dump({"count":len(urls), "urls":urls}, open(f"{out_dir}/fb-v1-urls.json","w"), ensure_ascii=False, indent=2)
PY

# Step 3: crawl each post (cap 10)
URLS_JSON="$OUT_DIR/fb-v1-urls.json"
URLS=$(python3 -c "import json;d=json.load(open('$URLS_JSON'));print(' '.join(d['urls'][:10]))")
if [[ -z "$URLS" ]]; then
  echo "[fb-v1] No URLs. Exiting." >&2
  echo '{"source_type":"facebook","count":0,"items":[]}' > "$OUT_DIR/fb-v1-extracted.json"
  exit 0
fi

echo "[fb-v1] Step 3: crawling FB posts..." >&2
# shellcheck disable=SC2086
$CRAWL multi $URLS --fit >/dev/null 2>&1
cp /tmp/crawl4ai-result.json "$OUT_DIR/fb-v1-posts.json"

# Step 4: M2.7 extraction
echo "[fb-v1] Step 4: M2.7 extraction..." >&2
python3 /Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/scripts/extract-m27.py \
  "$OUT_DIR/fb-v1-posts.json" \
  "$OUT_DIR/fb-v1-extracted.json" \
  "facebook"

echo "[fb-v1] Done. $OUT_DIR/fb-v1-extracted.json" >&2

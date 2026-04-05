#!/usr/bin/env bash
# pipeline-web-v1.sh — Web ingestion pipeline (Tuoi Tre + Kenh14 + VnExpress via Google)
# 3-day window, keyword-driven.
#
# Usage: pipeline-web-v1.sh "<keyword>" [output_dir]
# Output: {dir}/web-v1-raw-urls.json, web-v1-articles.json, web-v1-extracted.json

set -euo pipefail

KEYWORD="${1:?keyword required}"
OUT_DIR="${2:-/Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/outputs}"
mkdir -p "$OUT_DIR"

CRAWL="python3 $HOME/.openclaw/common-scripts/research/crawl-web.py"
TODAY=$(date +%Y%m%d)
CUTOFF=$(date -v-3d +%Y%m%d 2>/dev/null || date -d '-3 days' +%Y%m%d)

echo "[web-v1] Keyword: $KEYWORD | Cutoff: $CUTOFF → $TODAY" >&2

# URL-encode keyword
ENCKEY=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote_plus(sys.argv[1]))" "$KEYWORD")

# Step 1: scrape search pages
echo "[web-v1] Step 1: scraping search pages..." >&2
$CRAWL multi \
  "https://tuoitre.vn/tim-kiem.htm?keywords=${ENCKEY}" \
  "https://kenh14.vn/tim-kiem.chn?keyword=${ENCKEY}" \
  "https://www.google.com/search?q=site:vnexpress.net+${ENCKEY}&tbs=qdr:w" \
  >/dev/null 2>&1

# Step 2: extract URLs + filter by date (3-day window)
echo "[web-v1] Step 2: extracting URLs + filtering by date..." >&2
python3 - "$CUTOFF" "$OUT_DIR" <<'PY'
import json, re, sys
cutoff_num = int(sys.argv[1])  # YYYYMMDD int
out_dir = sys.argv[2]
data = json.load(open('/tmp/crawl4ai-result.json'))

urls = set()
for r in data['results']:
    md = r.get('markdown') or ''
    host = r.get('url','')
    # Tuoi Tre: ...-YYYYMMDDHHMMSSffff.htm  (date = chars 0-7 of numeric suffix)
    for m in re.finditer(r'https://tuoitre\.vn/[a-z0-9\-]+-(\d{14,20})\.htm', md):
        url = m.group(0); ts = m.group(1)[:8]
        if int(ts) >= cutoff_num:
            urls.add(url)
    # Kenh14: ...-215YYMMDDHHMMSS...chn
    for m in re.finditer(r'https://(?:www\.)?kenh14\.vn/[a-z0-9\-]+-215(\d{6})\d+\.chn', md):
        url = m.group(0); yymmdd = m.group(1)
        yyyymmdd = int("20" + yymmdd)
        if yyyymmdd >= cutoff_num:
            urls.add(url)
    # VnExpress via Google SERP: full URL pattern
    for m in re.finditer(r'https://vnexpress\.net/[a-z0-9\-]+-(\d+)\.html', md):
        urls.add(m.group(0))  # cannot date-filter from URL reliably, keep all

urls = sorted(urls)
print(f"[web-v1] found {len(urls)} URLs within 3-day window", file=sys.stderr)
json.dump({"keyword": "", "urls": urls, "count": len(urls)}, open(f"{out_dir}/web-v1-raw-urls.json","w"), ensure_ascii=False, indent=2)
PY

# Step 3: crawl each article (cap 15 to control cost)
URLS_JSON="$OUT_DIR/web-v1-raw-urls.json"
URLS=$(python3 -c "import json;d=json.load(open('$URLS_JSON'));print(' '.join(d['urls'][:15]))")
if [[ -z "$URLS" ]]; then
  echo "[web-v1] No URLs to crawl. Exiting." >&2
  exit 0
fi

echo "[web-v1] Step 3: crawling $(echo $URLS | wc -w | xargs) articles..." >&2
# shellcheck disable=SC2086
$CRAWL multi $URLS --fit >/dev/null 2>&1
cp /tmp/crawl4ai-result.json "$OUT_DIR/web-v1-articles.json"

# Step 4: M2.7 extraction
echo "[web-v1] Step 4: M2.7 extraction..." >&2
python3 /Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/scripts/extract-m27.py \
  "$OUT_DIR/web-v1-articles.json" \
  "$OUT_DIR/web-v1-extracted.json" \
  "web" >&2

echo "[web-v1] Done. Output: $OUT_DIR/web-v1-extracted.json" >&2

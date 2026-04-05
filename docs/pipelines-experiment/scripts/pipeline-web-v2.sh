#!/usr/bin/env bash
# pipeline-web-v2.sh — v2: Google SERP (site: + tbs=qdr:d3) for all 3 sites
# - Strict 3-day filter via Google
# - Stratified sampling per site
# - Slug keyword filter to reject noise
#
# Usage: pipeline-web-v2.sh "<keyword>" [output_dir]

set -euo pipefail
KEYWORD="${1:?keyword required}"
OUT_DIR="${2:-/Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/outputs}"
mkdir -p "$OUT_DIR"

CRAWL="python3 $HOME/.openclaw/common-scripts/research/crawl-web.py"
ENCKEY=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote_plus(sys.argv[1]))" "$KEYWORD")

echo "[web-v2] Keyword: $KEYWORD" >&2

# Step 1: Google SERP for each site, past 3 days
echo "[web-v2] Step 1: Google SERP x3 sites (qdr:d3)..." >&2
$CRAWL multi \
  "https://www.google.com/search?q=site:tuoitre.vn+${ENCKEY}&tbs=qdr:d3&num=20" \
  "https://www.google.com/search?q=site:vnexpress.net+${ENCKEY}&tbs=qdr:d3&num=20" \
  "https://www.google.com/search?q=site:kenh14.vn+${ENCKEY}&tbs=qdr:d3&num=20" \
  >/dev/null 2>&1
cp /tmp/crawl4ai-result.json "$OUT_DIR/web-v2-serps.json"

# Step 2: Extract URLs stratified per source + slug keyword filter
echo "[web-v2] Step 2: extract + filter URLs..." >&2
python3 - "$KEYWORD" "$OUT_DIR" <<'PY'
import json, re, sys, unicodedata
keyword = sys.argv[1]; out_dir = sys.argv[2]

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c) != 'Mn')

# Build slug-tokens from keyword (remove diacritics, split)
slug_tokens = [t for t in strip_accents(keyword.lower()).split() if len(t) >= 3]
print(f"[web-v2] slug-tokens: {slug_tokens}", file=sys.stderr)

d = json.load(open(f"{out_dir}/web-v2-serps.json"))
patterns = {
    'tuoitre.vn':   r'https://tuoitre\.vn/[a-z0-9\-]+-\d{14,20}\.htm[l]?',
    'vnexpress.net': r'https://vnexpress\.net/[a-z0-9\-]+-\d+\.html',
    'kenh14.vn':    r'https://(?:www\.)?kenh14\.vn/[a-z0-9\-]+-215\d+\.chn',
}
per_source = {k:[] for k in patterns}
for r in d['results']:
    md = r.get('markdown') or ''
    for src, pat in patterns.items():
        for m in re.finditer(pat, md):
            url = m.group(0)
            slug = url.lower()
            # Keyword slug filter: at least 1 token in URL
            if any(t in slug for t in slug_tokens):
                per_source[src].append(url)

# Dedup + limit per source
picked = []
for src, urls in per_source.items():
    seen = list(dict.fromkeys(urls))[:5]
    print(f"[web-v2]   {src}: {len(urls)} total, {len(seen)} after dedup/cap", file=sys.stderr)
    picked.extend(seen)

json.dump({"count":len(picked), "urls":picked}, open(f"{out_dir}/web-v2-urls.json","w"), ensure_ascii=False, indent=2)
PY

URLS_JSON="$OUT_DIR/web-v2-urls.json"
URLS=$(python3 -c "import json;print(' '.join(json.load(open('$URLS_JSON'))['urls']))")
if [[ -z "$URLS" ]]; then
  echo "[web-v2] No URLs. Exiting." >&2
  echo '{"source_type":"web","count":0,"items":[]}' > "$OUT_DIR/web-v2-extracted.json"
  exit 0
fi

# Step 3: crawl articles
echo "[web-v2] Step 3: crawling articles..." >&2
# shellcheck disable=SC2086
$CRAWL multi $URLS --fit >/dev/null 2>&1
cp /tmp/crawl4ai-result.json "$OUT_DIR/web-v2-articles.json"

# Step 4: M2.7 extraction
echo "[web-v2] Step 4: M2.7 extraction..." >&2
python3 /Users/phucnt/workspace/openclaw-workspace/plans/260405-0654-epidemic-pipelines-experiment/scripts/extract-m27.py \
  "$OUT_DIR/web-v2-articles.json" \
  "$OUT_DIR/web-v2-extracted.json" \
  "web"

echo "[web-v2] Done. $OUT_DIR/web-v2-extracted.json" >&2

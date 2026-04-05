# Tools & Stack Reference

Toàn bộ tools, dependencies, invocation syntax dùng trong 3 pipelines. Stack có thể port sang my-epidemic-monitor mà **không cần OpenClaw**.

---

## 1. Crawl4AI — Web → Markdown

**Role**: Fetch HTML + extract clean Markdown (async, browser-based via Playwright).

**Package**: `crawl4ai>=0.4` (Python)
**Install**: `pip install crawl4ai && playwright install chromium`
**Docs**: https://github.com/unclecode/crawl4ai

**Core usage** (đã wrap trong `scripts/crawl-web.py`):
```python
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig

async with AsyncWebCrawler(config=BrowserConfig(verbose=False)) as crawler:
    result = await crawler.arun(
        url=url,
        config=CrawlerRunConfig(
            word_count_threshold=0,
            remove_overlay_elements=True,
            process_iframes=False,
        )
    )
    markdown_content = str(result.markdown)
```

**Performance**: ~2-3s/page, RAM ~150MB/browser. Supports concurrent crawls via `arun_many()`.

**Why Crawl4AI vs raw fetch**: Handles SPA (JS-rendered), strips ads/scripts, produces LLM-friendly Markdown. Extracts title, links_count, word_count metadata.

**CLI wrapper** provided: `scripts/extract-m27.py` accepts JSON from crawl output directly. Wrapper shell patterns:
```bash
python3 crawl-web.py multi "url1" "url2" "url3" --fit   # --fit compresses markdown
cat /tmp/crawl4ai-result.json  # result
```

---

## 2. MiniMax M2.7 via OpenRouter

**Role**: Structured entity extraction (disease/province/district/cases/deaths/severity/summary) từ Vietnamese text.

**Model ID**: `minimax/minimax-m2.7`
**Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
**Pricing**: $0.30/1M input + $1.20/1M output tokens
**Context window**: 204K tokens
**Tool calling**: Yes (JSON mode supported)
**Vietnamese quality**: ★★★★ (tested)

**Why M2.7 over GPT-4/Claude**:
- Rẻ hơn ~10x
- Tiếng Việt tốt
- JSON object response format
- Đã proven trên OpenClaw stack

**API signature**:
```http
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer sk-or-v1-...
Content-Type: application/json
HTTP-Referer: <your app>
X-Title: <your app name>

{
  "model": "minimax/minimax-m2.7",
  "messages": [
    {"role": "system", "content": "<extraction prompt>"},
    {"role": "user", "content": "<article content>"}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.1
}
```

**System prompt used** (đã optimize):
```
Bạn là chuyên gia phân tích dữ liệu dịch bệnh Việt Nam. Extract thông tin từ bài báo/transcript/post.

Trả về JSON object với các trường:
- is_outbreak_news: true nếu là tin dịch bệnh thực sự (có ca, ổ dịch, cảnh báo), false nếu bài hướng dẫn sức khỏe, quảng cáo...
- disease: tên bệnh tiếng Anh normalized (dengue|measles|hand-foot-mouth|tuberculosis|influenza|covid-19|rabies|cholera|typhoid|hepatitis|chikungunya|diphtheria|meningitis|other)
- disease_vn: tên bệnh tiếng Việt
- province: tên tỉnh/thành VN (chuẩn: "TP.HCM", "Hà Nội"...)
- district: quận/huyện
- cases: số ca (int)
- deaths: số tử vong (int)
- severity: "outbreak" | "warning" | "watch"
- date: YYYY-MM-DD
- confidence: 0.0-1.0
- summary_vi: 1 câu tóm tắt tiếng Việt
```

Xem full implementation: `scripts/extract-m27.py`.

**Fallback chain gợi ý** (nếu M2.7 downtime):
1. `google/gemini-2.0-flash-exp:free` — free, tiếng Việt OK
2. Local Ollama `qwen2.5:3b` — fully offline, chậm hơn

---

## 3. YouTube Data API v3 + yt-dlp

### YouTube Data API v3 (search)

**Role**: Search videos by keyword + date filter.
**Auth**: API key required (Google Cloud Console, free quota 10K units/day, search costs 100/request).

**Endpoint**: `https://www.googleapis.com/youtube/v3/search`

**Example query**:
```
GET /youtube/v3/search?
  part=snippet
  &q=sốt xuất huyết
  &type=video
  &maxResults=10
  &order=date
  &publishedAfter=2026-04-02T00:00:00Z
  &key=<API_KEY>
```

**Response**: Array of `{id: {videoId}, snippet: {title, channelTitle, publishedAt, description}}`.

### yt-dlp (channel monitoring, no quota)

**Role**: Monitor specific channels for new uploads without API quota.

**Install**: `pip install yt-dlp`

**Usage**:
```bash
yt-dlp --flat-playlist --print-json --playlist-end 10 \
  "https://www.youtube.com/@WHO/videos"
```

Output: JSON per video with `{id, title, upload_date, duration, view_count}`.

---

## 4. MLX Whisper (Vietnamese Transcript)

**Role**: Transcribe YouTube video audio → Vietnamese text.

**Why MLX Whisper**:
- Metal GPU on Apple Silicon (much faster than CPU)
- Free, no API quota
- Supports Vietnamese natively

**Install** (Mac only):
```bash
pip install mlx-whisper yt-dlp
```

**Usage**:
```bash
# 1. Download audio
yt-dlp -x --audio-format mp3 -o "/tmp/audio.%(ext)s" "https://youtu.be/VIDEO_ID"

# 2. Transcribe
python3 -c "
import mlx_whisper
result = mlx_whisper.transcribe('/tmp/audio.mp3', path_or_hf_repo='mlx-community/whisper-large-v3-mlx', language='vi')
print(result['text'])
"
```

**Performance**: ~30-90s per video (depends on length). 5-min video → ~30s on M4.

**Alternative for non-Mac**:
- Faster-whisper (CPU/CUDA): `pip install faster-whisper`
- OpenAI Whisper API: $0.006/minute

---

## 5. Google SERP Scraping (for 3-day window filter)

**Role**: Cửa sổ 3 ngày strict cho cả web VN và Facebook (bypass native search limitations).

**URL pattern**:
```
https://www.google.com/search
  ?q=site:<domain>+<keyword>
  &tbs=qdr:d3                  # d3 = past 3 days, w = past week, m = past month
  &num=20
```

**Examples**:
- `site:tuoitre.vn "sốt xuất huyết"` + past 3 days
- `site:facebook.com "sốt xuất huyết"` + past 3 days

**Caveats**:
- Google có rate limit (quickly 429 sau ~10-20 requests từ cùng IP)
- Crawl4AI dùng headless Chromium → thường pass được
- Consider proxies or rate limiting nếu scale lớn
- **Alternative** (paid): SerpAPI $50/month, Serper $50/month

**URL extraction regex** (per domain):
```python
patterns = {
  'tuoitre.vn':    r'https://tuoitre\.vn/[a-z0-9\-]+-\d{14,20}\.htm[l]?',
  'vnexpress.net': r'https://vnexpress\.net/[a-z0-9\-]+-\d+\.html',
  'kenh14.vn':     r'https://(?:www\.)?kenh14\.vn/[a-z0-9\-]+-215\d+\.chn',
  'facebook.com':  r'https://(?:www\.)?facebook\.com/[^\s\)]+/posts/[^\s\)\?\&]+',
}
```

---

## 6. Facebook — Playwright Browser Automation (Optional)

**Role**: Scrape Facebook group posts với persistent login session.

**Use case**: Nếu cần deep monitoring specific VN health groups (HCDC, NIHE, hospital pages) — không đi qua Google SERP.

**Stack**:
- Playwright Python: `pip install playwright && playwright install chromium`
- Persistent user data dir (1 lần login, session reused)

**Reference**: OpenClaw đã có `fb-group-monitor.py` sẵn. Pattern:
```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    context = await p.chromium.launch_persistent_context(
        user_data_dir="./fb-session",
        headless=True,
    )
    page = await context.new_page()
    await page.goto("https://www.facebook.com/groups/EPIDATA")
    posts = await page.query_selector_all('[role="article"]')
    # extract text, screenshots, links
```

**Not essential** cho thí nghiệm — Google SERP workaround đã đủ cho v1.

---

## Dependencies Summary

```python
# requirements.txt (port to my-epidemic-monitor side)
crawl4ai>=0.4.0
yt-dlp>=2024.8.0
mlx-whisper>=0.3.0        # Mac only, else use faster-whisper
requests>=2.31.0
```

**For Vercel/Node.js side** (alternative): port shell scripts + Python extraction to Node.js using:
- `@adobe/helix-md2html` hoặc custom markdown cleaner
- `node-fetch` cho OpenRouter API
- Offload Crawl4AI to separate Python service (Lambda/Modal/Railway)

---

## Data Flow per Pipeline (end-to-end)

### Web Pipeline (full flow)
```
Input: keyword = "tay chân miệng"
  → URL-encode: "tay+chan+mieng"
  → crawl4ai multi:
     - google.com/search?q=site:tuoitre.vn+<kw>&tbs=qdr:d3
     - google.com/search?q=site:vnexpress.net+<kw>&tbs=qdr:d3
     - google.com/search?q=site:kenh14.vn+<kw>&tbs=qdr:d3
  → Extract URLs via regex (per-domain patterns)
  → Filter URLs where slug contains keyword-tokens
  → crawl4ai multi [urls] --fit
  → clean_markdown() strip nav boilerplate
  → M2.7 extraction (JSON mode)
  → Filter is_outbreak_news=true
Output: OutbreakItem[] (6 items for this keyword, 3-day window)
```

### YouTube Pipeline
```
Input: keyword = "sốt xuất huyết"
  → YouTube Data API search (order=date, publishedAfter=3d ago)
  → Extract video_ids
  → For each: yt-dlp → mp3 → MLX Whisper → VN transcript
  → M2.7 extraction on transcript
Output: OutbreakItem[] (~1-3/keyword)
```

### Facebook Pipeline
```
Input: keyword = "sốt xuất huyết"
  → Google SERP site:facebook.com tbs=qdr:d3
  → Extract FB URLs (posts, videos, permalink, groups/*/posts)
  → crawl4ai multi [urls] --fit
  → M2.7 extraction
Output: OutbreakItem[] (~2-5/keyword, cases often null)
```

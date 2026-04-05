# Scripts — Source Code

Các script đã test và chạy thành công. **Paths cần update khi port** (hiện đang reference `$HOME/.openclaw/...`).

## Files

| File | Role | Dependencies |
|------|------|--------------|
| `crawl-web.py` | Crawl4AI wrapper (web→markdown) | `pip install crawl4ai && playwright install chromium` |
| `search-videos.sh` | YouTube Data API search wrapper | Cần YouTube API key + `youtube.py` (not included) |
| `get-transcript.sh` | MLX Whisper transcript wrapper | `pip install mlx-whisper yt-dlp` (Mac only) |
| `extract-m27.py` | M2.7 OpenRouter extractor + clean_markdown | `OPENROUTER_API_KEY` env |
| `pipeline-web-v1.sh` | ❌ Native search (reference, 0 items) | — |
| `pipeline-web-v2.sh` | ✅ Google SERP + slug filter | crawl-web.py, extract-m27.py |
| `pipeline-youtube-v1.sh` | ✅ YT search + transcript | search-videos.sh, get-transcript.sh, extract-m27.py |
| `pipeline-facebook-v1.sh` | ✅ Google site:facebook.com + crawl | crawl-web.py, extract-m27.py |

## Paths to Update

Các shell scripts hardcode paths:
```bash
CRAWL="python3 $HOME/.openclaw/common-scripts/research/crawl-web.py"
~/.openclaw/common-scripts/youtube/search-videos.sh
~/.openclaw/common-scripts/youtube/get-transcript.sh
```

Khi port sang repo mới, thay `$HOME/.openclaw/common-scripts/...` bằng path trong repo (ví dụ `pipeline-service/scripts/`).

## Running locally

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export YOUTUBE_API_KEY="..."   # chỉ cần nếu dùng YouTube pipeline

# Test web pipeline
bash pipeline-web-v2.sh "tay chân miệng" ./outputs

# Test YouTube pipeline
bash pipeline-youtube-v1.sh "sốt xuất huyết" ./outputs

# Test Facebook pipeline
bash pipeline-facebook-v1.sh "sốt xuất huyết" ./outputs
```

Output JSON sẽ ở `./outputs/{source}-v{N}-extracted.json`.

## YouTube API Setup

`search-videos.sh` cần `youtube.py` skill (not included here). Alternative: dùng Python google-api-python-client trực tiếp:

```python
from googleapiclient.discovery import build
yt = build('youtube', 'v3', developerKey=os.environ['YOUTUBE_API_KEY'])
res = yt.search().list(
    q='sốt xuất huyết', part='snippet', type='video',
    maxResults=10, order='date',
    publishedAfter='2026-04-02T00:00:00Z'
).execute()
```

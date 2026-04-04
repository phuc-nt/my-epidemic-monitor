# Data Enrichment Pipeline — Giải pháp Thu thập & Phân tích Dữ liệu Dịch bệnh

> Tận dụng Crawl4AI + LLM (MiniMax M2.7 via OpenRouter) để nâng cấp pipeline dữ liệu từ RSS summaries → full article extraction → structured outbreak data.

**Ngày**: 2026-04-04 | **Tác giả**: MK Agent

---

## Vấn đề Hiện tại

| Vấn đề | Ảnh hưởng | Root Cause |
|--------|-----------|-----------|
| **Cases = 0%** | Không có số ca bệnh | RSS chỉ cho tiêu đề + mô tả ngắn |
| **District = 0%** | Không extract được quận/huyện | Thiếu full article content |
| **URL 404 sau 1-2 ngày** | Mất data lịch sử | Báo VN xoá/redirect bài cũ |
| **Regex cứng (20 patterns)** | Miss nhiều case | Không adapt được với cách viết khác nhau |
| **WHO/CDC timeout** | Thiếu nguồn quốc tế | Dev middleware rate-limit |

---

## Giải pháp: 3-Tier Enrichment Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 1: RSS Ingestion                         │
│                    (giữ nguyên, real-time)                       │
│                                                                  │
│  VnExpress ─┐                                                   │
│  Tuổi Trẻ  ─┤                                                   │
│  Thanh Niên ─┼──▶ RSS Parser ──▶ title + link + pubDate         │
│  VietnamNet ─┤       │                                           │
│  Dân Trí   ─┤       │ Filter: health/epidemic keywords          │
│  WHO-DON   ─┘       │                                           │
│                      ▼                                           │
│              URLs mới (chưa crawl)                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 2: Deep Crawl                            │
│                    (Crawl4AI — MỚI)                              │
│                                                                  │
│  crawl-web.py markdown <url>                                    │
│       │                                                          │
│       ├──▶ Full article → clean Markdown                        │
│       ├──▶ Cache vào DB (tránh 404)                             │
│       └──▶ Metadata: word_count, title, links                  │
│                                                                  │
│  Batch: crawl-web.py multi url1 url2 url3 ...                   │
│  Output: /tmp/crawl4ai-result.json                              │
│  Speed: ~2-3s/page, 50+ concurrent trên M4 24GB                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 3: LLM Extraction                        │
│                    (MiniMax M2.7 via OpenRouter)                  │
│                                                                  │
│  Input: article markdown                                        │
│  Output: structured JSON                                        │
│                                                                  │
│  {                                                               │
│    "disease": "dengue",        // Normalized EN name             │
│    "disease_vn": "sốt xuất huyết",                              │
│    "province": "Hà Nội",                                        │
│    "district": "Đống Đa",     // NEW — từ full article          │
│    "cases": 47,                // NEW — extract từ bài           │
│    "deaths": 0,                                                  │
│    "severity": "warning",     // outbreak|warning|watch          │
│    "date": "2026-04-03",      // Ngày sự kiện (không pubDate)   │
│    "source_type": "news",     // news|official|social            │
│    "confidence": 0.85,        // LLM tự đánh giá                │
│    "summary_vi": "47 ca SXH tại quận Đống Đa..."               │
│  }                                                               │
│                                                                  │
│  Model: openrouter/minimax/minimax-m2.7                         │
│  Cost: ~$0.30/1M input + $1.20/1M output                       │
│  Est: 50 articles/ngày × ~2K tokens = ~$0.05/ngày              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Công cụ & Cấu hình

### Crawl4AI

Đã cài trên máy. Wrapper script: `~/.openclaw/common-scripts/research/crawl-web.py`

```bash
# Crawl 1 bài
python3 ~/.openclaw/common-scripts/research/crawl-web.py markdown "https://vnexpress.net/sot-xuat-huyet-tang-4321.html"
cat /tmp/crawl4ai-result.json

# Crawl nhiều bài song song
python3 ~/.openclaw/common-scripts/research/crawl-web.py multi \
  "https://vnexpress.net/..." \
  "https://tuoitre.vn/..." \
  "https://dantri.com.vn/..."
```

### LLM: MiniMax M2.7 (OpenRouter)

```bash
# Extraction prompt
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
    "model": "minimax/minimax-m2.7",
    "messages": [{
      "role": "system",
      "content": "Extract epidemic data from Vietnamese news articles. Return JSON only."
    }, {
      "role": "user",
      "content": "<article markdown here>"
    }],
    "response_format": { "type": "json_object" }
  }'
```

**Tại sao M2.7?**
- Rẻ nhất có tool calling + JSON mode ($0.30/$1.20 per 1M tokens)
- Tiếng Việt tốt (★★★★)
- 204K context window — đủ cho bài báo dài nhất
- Đã dùng cho tất cả OpenClaw agents, đã kiểm chứng production

### Alternatives (fallback)

| Model | Khi nào | Cost |
|-------|---------|------|
| M2.7 (primary) | Mọi lúc | $0.05/ngày |
| Gemini 2.0 Flash | M2.7 timeout | $0.02/ngày |
| Ollama/Qwen3:4b | Offline, $0 | Free nhưng chậm |

---

## LLM Extraction Prompt

```
Bạn là chuyên gia phân tích dữ liệu dịch bệnh. Extract thông tin từ bài báo y tế Việt Nam.

Trả về JSON với các trường:
- disease: tên bệnh tiếng Anh (normalized: dengue, measles, hand-foot-mouth, tuberculosis, influenza, covid-19, rabies, cholera, typhoid, hepatitis)
- disease_vn: tên bệnh tiếng Việt
- province: tên tỉnh/thành (63 tỉnh VN). null nếu không có
- district: tên quận/huyện. null nếu không có
- cases: số ca bệnh (int). null nếu không đề cập
- deaths: số tử vong (int). null nếu không đề cập
- severity: "outbreak" (bùng phát, tăng mạnh), "warning" (cảnh báo, gia tăng), "watch" (theo dõi, thông thường)
- date: ngày sự kiện xảy ra (YYYY-MM-DD). null nếu không rõ
- is_outbreak_news: true nếu đây là tin dịch bệnh, false nếu là bài hướng dẫn sức khỏe
- confidence: 0.0-1.0 mức độ tin cậy extraction
- summary_vi: tóm tắt 1 câu tiếng Việt

Nếu bài viết KHÔNG phải tin dịch bệnh (bài hướng dẫn sức khỏe, quảng cáo thuốc...) → is_outbreak_news: false.
```

---

## Implementation: TypeScript Integration

### Option A: Server-side Cron (Khuyến nghị cho production)

```typescript
// api/cron/enrich-articles.ts (Vercel Cron)
import { crawlArticle, extractEpidemicData } from '@/services/enrichment';

export async function GET() {
  // 1. Get un-enriched items from DB
  const items = await getUnenrichedItems(limit: 20);
  
  // 2. Crawl full articles
  const articles = await Promise.allSettled(
    items.map(item => crawlArticle(item.url))
  );
  
  // 3. LLM extract
  const extracted = await Promise.allSettled(
    articles
      .filter(a => a.status === 'fulfilled')
      .map(a => extractEpidemicData(a.value.markdown))
  );
  
  // 4. Store enriched data
  await storeEnrichedData(extracted);
  
  return Response.json({ processed: extracted.length });
}
```

### Option B: Client-side Background (Hiện tại — cải thiện)

```typescript
// src/services/article-content-fetcher.ts — upgrade
import { fetchWithCrawl4ai } from './crawl4ai-client';

async function enrichArticle(item: OutbreakItem): Promise<EnrichedItem> {
  // Crawl4AI thay vì simple fetch
  const markdown = await fetchWithCrawl4ai(item.link);
  
  // Cache ngay (tránh 404)
  await cacheArticle(item.link, markdown);
  
  // LLM extract via OpenRouter
  const extracted = await extractWithM27(markdown);
  
  return { ...item, ...extracted };
}
```

---

## YouTube Health News Pipeline

### Nguồn Video

| Channel | Focus | Frequency | Language |
|---------|-------|-----------|----------|
| **WHO** | Global alerts, briefings | Weekly | EN |
| **VTV24** | VN health news, epidemic updates | Daily | VN |
| **Sức khỏe & Đời sống (MOH)** | Official VN health ministry | Weekly | VN |
| **CDC** | US disease alerts | Weekly | EN |

### Pipeline

```
YouTube RSS (channel feeds)
    │
    ├──▶ Filter: title contains disease keywords
    │    (dịch, outbreak, sốt, dengue, measles...)
    │
    ├──▶ get-transcript.sh <VIDEO_ID>
    │    (free API → fallback MLX Whisper local)
    │
    ├──▶ LLM extract (M2.7):
    │    - Disease mentioned
    │    - Countries/provinces
    │    - Case numbers (if mentioned)
    │    - Severity assessment
    │
    └──▶ Store as "video" source type
         (separate from news articles)
```

**YouTube RSS format**: `https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`

| Channel | Channel ID |
|---------|------------|
| WHO | `UC07-dOwgza1IguKA86jqxNA` |
| VTV24 | `UCsWsEvLGB5cRYB6_L3ROPzA` |
| CDC | `UCLPbTZMdjEU7xWLM-cMA3g` |

---

## Experimental Pipelines (Thử nghiệm)

### 1. Cross-Source Signal Detection

```
Khi ≥2 nguồn ĐỘC LẬP đề cập cùng disease + province trong 48h:
  → Tự động escalate severity lên 1 bậc
  → Trigger breaking news banner

VD: VnExpress + Tuổi Trẻ cùng nói "SXH tăng ở Đống Đa"
  → confidence: HIGH (2 sources)
  → severity: warning → outbreak
```

Đã implement sơ bộ (`cross-source signal detection`). Nâng cấp bằng LLM:

```typescript
// Thay Jaccard similarity bằng LLM semantic matching
const isRelated = await m27.chat({
  prompt: `Are these 2 articles about the same outbreak?
    A: "${article1.summary}"
    B: "${article2.summary}"
    Reply: {"same": true/false, "confidence": 0-1}`
});
```

### 2. Trend Prediction (Climate + Historical)

```
Climate forecast (Open-Meteo 14-day)
    +
Historical outbreak data (IndexedDB 30-day)
    │
    ▼
LLM Analysis (M2.7):
  "Given 14-day weather forecast showing temp 28°C + humidity 85%
   and historical data showing 3 dengue outbreaks in this province
   in similar conditions, predict risk level for next 7 days"
    │
    ▼
Risk Score: HIGH / MEDIUM / LOW
    +
Recommended Actions
```

### 3. HCDC/NIHE Web Scraping (P1 nguồn chính thức VN)

```
Crawl4AI:
  https://hcdc.vn/          → TP.HCM CDC
  https://vncdc.gov.vn/     → Vietnam CDC (NIHE)
  https://moh.gov.vn/       → Bộ Y tế

  → Scrape bảng thống kê (nếu có)
  → LLM extract structured data
  → Đây là nguồn CHÍNH THỨC — confidence: 1.0
```

### 4. Social Media Early Warning (Experimental)

```
Crawl4AI → Facebook groups y tế địa phương
  → LLM filter: actual outbreak reports vs noise
  → Confidence: LOW (social, unverified)
  → Only use as EARLY WARNING signal
  
⚠️ Legal/ToS concerns — chỉ dùng public groups
```

### 5. Multi-language News Aggregation

```
Crawl4AI multi:
  → Reuters Health (EN)
  → The Lancet Infectious Diseases (EN, academic)
  → Nikkei Asia Health (EN, regional)
  → Bangkok Post Health (EN, ASEAN neighbor)

  → LLM filter: mentions Vietnam / ASEAN
  → Cross-reference with VN local news
  → Add international perspective to dashboard
```

---

## Ước tính Chi phí

### M2.7 via OpenRouter

| Tác vụ | Lần/ngày | Tokens/lần | Chi phí/ngày |
|--------|----------|-----------|-------------|
| Article extraction | 50 | ~2K input + ~500 output | $0.06 |
| News dedup (LLM tier 2) | 20 | ~1K | $0.01 |
| YouTube transcript summary | 5 | ~5K input + ~1K output | $0.02 |
| Cross-source correlation | 10 | ~2K | $0.01 |
| Trend prediction | 2 | ~3K | $0.01 |
| **Tổng** | | | **~$0.11/ngày ≈ $3.3/tháng** |

### Crawl4AI (Free, local)

| Metric | Value |
|--------|-------|
| Cost | $0 (local browser) |
| Speed | ~2-3s/page |
| RAM | ~150MB per browser instance |
| Concurrent | 50+ trên M4 24GB |

---

## Implementation Roadmap

### Phase 1: Article Enrichment (1 tuần)

- [ ] Integrate Crawl4AI vào `article-content-fetcher.ts`
- [ ] Thay `fetchArticleContent()` bằng Crawl4AI call
- [ ] Cache article markdown vào IndexedDB
- [ ] M2.7 extraction prompt → structured JSON
- [ ] Dashboard hiện: cases, deaths, district (từ LLM)

### Phase 2: YouTube + More Sources (1 tuần)

- [ ] YouTube RSS feeds (WHO, VTV24, CDC)
- [ ] Transcript extraction → LLM summary
- [ ] Thêm WHO GHO, Global.health API
- [ ] Video tab trong News panel

### Phase 3: Intelligence (2 tuần)

- [ ] Cross-source LLM correlation (thay Jaccard)
- [ ] Climate + historical trend prediction
- [ ] HCDC/NIHE web scraping (nếu có data)
- [ ] Auto severity escalation

### Phase 4: Production (ongoing)

- [ ] Vercel Cron cho background enrichment
- [ ] Monitoring dashboard (crawl success rate, LLM accuracy)
- [ ] Cost tracking (OpenRouter usage)
- [ ] A/B test extraction quality: M2.7 vs Gemini Flash

---

## So sánh: Trước vs Sau

| Metric | Hiện tại | Sau Pipeline |
|--------|----------|-------------|
| **Sources** | 6 RSS + WHO-DON | 6 RSS + WHO-DON + YouTube + international APIs |
| **Article content** | Tiêu đề + mô tả ngắn | Full article Markdown |
| **Cases extraction** | 0% | ~85% (LLM) |
| **District extraction** | 0% | ~70% (LLM + ward DB) |
| **URL lifespan** | 1-2 ngày (404) | Vĩnh viễn (cached) |
| **Disease matching** | 20 regex | LLM + 67 aliases (100%) |
| **Cost** | $0 (RSS only) | ~$3.3/tháng (M2.7) |
| **Dedup quality** | Jaccard 0.4 | LLM semantic (95%+) |
| **Video sources** | 0 | WHO + VTV24 + CDC |

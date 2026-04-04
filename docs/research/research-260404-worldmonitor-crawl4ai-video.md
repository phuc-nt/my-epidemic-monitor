# Research: WorldMonitor Features, Crawl4AI Integration, Video News
**Date:** 2026-04-04 | **Research Scope:** Feature adoption, web scraping, video embedding

---

## 1. WorldMonitor Features Assessment

### Adoptable Components (Ranked by Epidemic Monitoring Value)

#### 🥇 **Breaking News Banner** — CRITICAL ADOPTION
**File:** `worldmonitor/src/components/BreakingNewsBanner.ts`

- **What:** Toast-style alerts (max 3 concurrent) with severity levels (critical/high), sound notifications, auto-dismiss timers
- **Why for Epidemic:** Health crises need urgent alerts. Outbreak detection, vaccine alerts, emergency advisories. Currently, Epidemic Monitor has no breaking news layer
- **Implementation:** ~300 LOC, event-driven (`wm:breaking-news` CustomEvent), localStorage dedup, settings persistence
- **Risk:** Low. Pure UI component, zero domain coupling
- **Estimate:** 1 day to adapt for epidemic context (new threat types: outbreak_cluster, vaccine_shortage, etc.)

#### 🥈 **Cross-Source Signals Panel** — HIGH ADOPTION
**File:** `worldmonitor/src/components/CrossSourceSignalsPanel.ts`

- **What:** Aggregates 15+ feeds, detects composite escalations when 3+ signal types co-fire, scores by severity
- **Why for Epidemic:** Multiple sources report same outbreak → composite signal → escalate to CRITICAL. Captures WHO+CDC+MOH-VN alignment on disease spread
- **Implementation:** Correlation engine (`worldmonitor/src/services/correlation-engine/`), domain adapters pattern, LLM-based assessment
- **Risk:** Medium. Requires distributed correlation logic. WorldMonitor has 4 domain adapters (military, economic, disaster, escalation)
- **Estimate:** 3–4 days to implement epidemic-specific correlation (disease outbreaks, climate triggers, case surges)

#### 🥉 **Social Velocity Panel** — MEDIUM ADOPTION
**File:** `worldmonitor/src/components/SocialVelocityPanel.ts`

- **What:** Monitors social media velocity (Reddit) — recency × score × upvote ratio. Detects emerging topics before mainstream coverage
- **Why for Epidemic:** Detects early signal of concern (e.g., "unknown respiratory illness" trending on Reddit before WHO announcement). Complements formal sources
- **Implementation:** Simple fetch + sort, Reddit API integration
- **Risk:** Low. Requires Reddit API key. Social signals are supplementary
- **Estimate:** 2 days (add Reddit API integration, filter for health keywords)

#### 🟡 **Country Deep Dive Panel** — MEDIUM-LOW ADOPTION
**File:** `worldmonitor/src/components/CountryDeepDivePanel.ts`

- **What:** Per-country dashboard with threat level, economic indicators, infrastructure risk, military posture, prediction markets
- **Why for Epidemic:** Vietnam-specific health data (MOH-VN compliance, provincial outbreak status, healthcare infrastructure, climate risk by district)
- **Implementation:** Integrates multiple data sources, complex layout (~1000 LOC)
- **Risk:** Medium. Requires significant customization for health domain
- **Estimate:** 1 week to build "District Deep Dive" for Vietnam (70 districts, case data, climate, healthcare capacity)

#### 🟢 **Disease Outbreaks Panel** — REFERENCE ONLY
**File:** `worldmonitor/src/components/DiseaseOutbreaksPanel.ts`

- **What:** Alert/Warning/Watch levels, source links, real-time filtering
- **Why for Epidemic:** Exact pattern match to Epidemic Monitor's existing outbreak panel. Already implemented in both systems
- **Implementation:** Already in Epidemic Monitor, identical to WorldMonitor
- **Risk:** None
- **Estimate:** 0 days (cross-check implementation, ensure parity with WHO/ProMED feeds)

---

## 2. Crawl4AI Integration Assessment

### What Crawl4AI Does
**GitHub:** https://github.com/unclecode/crawl4ai  
**Status:** Production-ready, 60K+ stars, Apache 2.0

**Core Capabilities:**
- Headless browser crawling (async/parallel)
- HTML→Markdown conversion (RAG-ready)
- Structured data extraction (CSS, XPath, LLM-based)
- JavaScript rendering (critical for MOH-VN site)
- Proxy + stealth modes
- Video/media extraction

### Can It Help Epidemic Monitor?

#### ✅ **MOH-VN Site Crawling** — YES, VIABLE
**Use Case:** Crawl moh.gov.vn for:
- Press releases (not in RSS feed)
- District-level outbreak data
- Vaccination campaign updates
- Healthcare facility status reports

**Why Needed:** MOH-VN RSS is minimal; press releases have structured data not syndicated.

**Integration Approach:**
```
Backend (Python):
1. Crawl4AI running in Docker (Railway or local)
2. REST API: POST /crawl with { url, extraction_rules }
3. Returns: { content: markdown, structured: {} }

Frontend (TypeScript):
1. Fetch from `/api/crawl-moh-vn`
2. Cache results (24h) in IndexedDB
3. Parse structured data → update outbreak panel
```

**Implementation Path:**
1. Docker setup: `docker run --name crawl4ai -p 11235:11235 crawl4ai:latest`
2. TypeScript REST client (3–4 LOC per endpoint)
3. Backend proxy in Express (`api/routes/crawl.ts`)

**Risk:** Medium
- MOH-VN may block automated requests → Use residential proxy or delay between requests
- HTML structure changes → Brittle CSS selectors → Use LLM-based extraction instead
- Estimated latency: 3–5s per page (browser rendering)

**Estimate:** 2 days (setup + integration + error handling)

#### ⚠️ **HCDC (Hanoi) District-Level Data** — PARTIAL
**Status:** Crawl4AI can scrape, but HCDC website structure is inconsistent.

**Challenge:** District health centers have no centralized API. Data lives in:
- Static HTML (old CDC site)
- Facebook posts (unstructured)
- Local dashboards (behind auth)

**Recommendation:** Crawl4AI can extract from *published* health center reports, but full district coverage requires either:
1. Direct API from HCDC (unavailable)
2. VPN + auth to internal systems (out of scope)
3. Manual district data entry (current MVP approach)

**Estimate:** 1 week to build reliable crawler, but low ROI (70 districts × 3 sites each = 210 requests/day)

#### ❌ **RSS Feed Replacement** — NOT RECOMMENDED
**Why:** WHO, CDC, ProMED all have mature RSS feeds. Crawl4AI adds latency, fragility, cost with minimal benefit.

---

## 3. Video News Integration

### Available Health Video Sources

#### **WHO Channels**
- **YouTube:** https://www.youtube.com/@WHO
- **Content:** Emergency response, vaccination campaigns, health threats
- **Feed:** YouTube Data API v3 (requires API key, 1M free quota/day)

#### **CDC Channels**
- **CDC-TV:** https://www.cdc.gov/digital-social-media-tools/cdctv/
- **Global Health:** https://www.cdc.gov/global-health/resources/videos.html
- **Emergency Response:** https://cdc.gov/cdctv/emergencypreparednessandresponse/
- **Feed:** YouTube API + direct video listing

#### **Vietnamese Health Sources**
- **VTV News** (state TV): Vietnam Today (vietnamtoday.vtv.vn)
- **Vietnam+** (official): en.vietnamplus.vn/health/
- **VnExpress Health:** e.vnexpress.net/taxonomy/health
- **MOH-VN:** Limited video presence (mostly PDFs/releases)
- **Facebook:** Vietnam Health News page (unstructured, 1.6M followers)

### Embedding Strategy: YOUTUBE oembed + IFrame API

**Best Practice:** Use YouTube's `iframe` embed pattern (no API key required for static embeds)

#### **Static Embed (No Auth)**
```typescript
// Works without API key
function embedYouTubeVideo(videoId: string): HTMLElement {
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}`;
  iframe.width = '100%';
  iframe.height = '400';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  return iframe;
}
```

**Pros:** Works anywhere, lightweight, privacy-respecting (no tracking unless opted in)
**Cons:** Cannot auto-detect live streams, no quality control

#### **Dynamic Feed (YouTube Data API v3)**
**Use Case:** Auto-fetch latest WHO/CDC videos, display in news panel

**Setup:**
1. Get API key: console.cloud.google.com → enable YouTube Data API v3
2. Query channel uploads: `https://www.googleapis.com/youtube/v3/search?channelId=UCxxx&part=snippet&maxResults=10`
3. Cache in IndexedDB (24h TTL)
4. Render with thumbnail + link

**Implementation (TypeScript):**
```typescript
async function fetchYouTubeVideos(channelId: string, maxResults = 5) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', YOUTUBE_API_KEY);
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('order', 'date');
  
  const resp = await fetch(url);
  return resp.json();
}
```

**Risk:** API key exposure → use backend proxy instead

**Better Approach:** Backend proxy
```
Frontend → Backend /api/videos/who?limit=5 → YouTube API
```

**Estimate:** 1 day (backend proxy + cache + UI)

### Integration Location in Epidemic Monitor

**Option A: Expand News Panel** (Recommended)
- Add "Media" tab in news-feed-panel.ts
- Show latest 3–5 WHO/CDC videos + latest Vietnamese health news videos
- 30–40 LOC modification

**Option B: New "Video News" Panel**
- Dedicated panel (8th panel)
- 24-hour video ticker from WHO + CDC + MOH-VN YouTube (if exists)
- 150–200 LOC new component

**Recommendation:** Option A. Epidemic Monitor prioritizes data density. Adding a tab to existing news panel is lower cognitive load.

---

## 4. Adoption Recommendations (Top 5)

### Ranking: Value × Feasibility × Adoption Risk

| Rank | Feature | Value | Effort | Risk | Timeline | Priority |
|------|---------|-------|--------|------|----------|----------|
| 1 | Breaking News Banner | ⭐⭐⭐ | 1d | Low | 1 day | P0 |
| 2 | YouTube Video Tab (News Panel) | ⭐⭐⭐ | 1d | Low | 1 day | P0 |
| 3 | Crawl4AI MOH-VN Integration | ⭐⭐ | 2d | Medium | 2 days | P1 |
| 4 | Cross-Source Signal Detection | ⭐⭐⭐ | 3d | Medium | 3–4 days | P1 |
| 5 | Country (Province) Deep Dive | ⭐⭐ | 5d | Medium | 5–7 days | P2 |

### Implementation Sequence

**Phase 1 (Immediate — 2 days, P0)**
1. **Breaking News Banner** ← Highest ROI, lowest risk
2. **YouTube Video Tab** ← Complements existing news panel

**Phase 2 (Week 2 — 2–3 days, P1)**
3. **Crawl4AI MOH-VN Crawler** ← Fills data gap for press releases

**Phase 3 (Week 3–4 — 3–4 days, P1)**
4. **Cross-Source Signals** ← Detects composite escalations (WHO+CDC+MOH alignment)

**Phase 4 (Backlog, P2)**
5. **District Deep Dive** ← Post-MVP enhancement

---

## 5. Technical Dependencies & Risks

| Dependency | Risk Level | Mitigation |
|------------|-----------|-----------|
| **YouTube API quota** | Low | 1M free queries/day; Epidemic Monitor likely <10K/day |
| **MOH-VN.gov.vn crawl blocks** | Medium | Use residential proxy (crawl4ai supports); rate limit (delay 5s between requests) |
| **Crawl4AI Docker resource** | Medium | Run separate container; 512MB RAM sufficient for 1–2 concurrent crawls |
| **Cross-source latency** | Medium | Cache correlations (30min TTL); run async, don't block UI |
| **Breaking news false positives** | Low | Threshold-based gating (score > 50 for "high", > 80 for "critical") |

---

## Conclusion

**Quick Wins (Implement in Phase 1):**
1. **Breaking News Banner** — High-impact alert system, proven pattern, 1 day
2. **YouTube Video Embed** — Enriches news panel, no auth friction, 1 day

**Medium-Term Gains (Phase 2–3):**
3. **Crawl4AI Integration** — Unlocks MOH-VN press release data, moderate complexity
4. **Cross-Source Signals** — Detects outbreak consensus across sources, separates signal from noise

**Avoid (Out of Scope):**
- Replacing RSS feeds with crawlers (brittle, latency)
- Full district-level scraping (low ROI, 210+ requests/day)
- Facebook scraping (unstructured, TOS risk)

---

## Unresolved Questions

1. **Does MOH-VN allow automated crawling?** → Test robots.txt + request rate before full integration
2. **Which Vietnamese health YouTube channels are official?** → Need manual audit; Facebook is more reliable for VN
3. **What alert threshold separates "breaking" from "background noise"?** → Recommend: start with manual curation (WHO+CDC only), automate post-MVP
4. **How to handle Crawl4AI rate limiting at scale?** → Current MVP: single concurrent crawler is fine; scale if needed

---

**Sources**
- [Crawl4AI Documentation](https://docs.crawl4ai.com/)
- [GitHub: unclecode/crawl4ai](https://github.com/unclecode/crawl4ai)
- [MCP Crawl4AI TypeScript](https://github.com/omgwtfwow/mcp-crawl4ai-ts)
- [YouTube Iframe API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [CDC-TV Videos](https://www.cdc.gov/digital-social-media-tools/cdctv/index.html)
- [WHO Vietnam News](https://www.who.int/vietnam/news)
- [Vietnam+ Health News](https://en.vietnamplus.vn/health/)

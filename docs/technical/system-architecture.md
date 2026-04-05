# Kiến Trúc Hệ Thống — Epidemic Monitor

> Tài liệu này dành cho cả developer lẫn người đọc "low-code". Mỗi quyết định kiến trúc đều có giải thích ngắn về **lý do tại sao** không chỉ là cái gì.

---

## Tổng quan

Epidemic Monitor là Vercel web app (display-only) theo dõi dịch bệnh Việt Nam theo thời gian thực. Không chạy pipeline; dữ liệu từ 2 nguồn độc lập:
1. **Quốc tế**: WHO DON API (server-side Vercel)
2. **Việt Nam hotspot**: FastAPI server trên Mac Mini (port 8742, qua Cloudflare tunnel)

Hệ thống được thiết kế **no-framework** (Vanilla TypeScript) để tránh vendor lock-in, giữ bundle size nhỏ, và tập trung vào display + AI analysis.

**Nguyên tắc thiết kế cốt lõi:**
- **Edge-first**: WHO/VN RSS parse trên Vercel Edge Functions
- **External pipeline**: Mac Mini (`openclaw` repo) crawl báo VN + YouTube + Facebook, extract LLM, SQLite store, API expose
- **Cache tầng đôi**: Server cache in-memory + client cache localStorage
- **Modular panels**: Mỗi panel độc lập, tự quản lý dữ liệu

---

## Kiến trúc hệ thống

```mermaid
graph TB
    subgraph External["Nguồn dữ liệu"]
        WHO["WHO DON API"]
        MM["Mac Mini Pipeline<br/>(openclaw)"]
        OWID["OWID CSV"]
        OM["Open-Meteo"]
        LLM_P["LLM Providers"]
    end

    subgraph Pipeline["Mac Mini (6h cron)"]
        WEB["Web crawl<br/>(Google SERP)"]
        YT["YouTube<br/>(transcript)"]
        FB["Facebook<br/>(Playwright)"]
        EXT["Extract<br/>(M2.7)"]
        DB["SQLite<br/>epidemic-monitor.db"]
        API["FastAPI<br/>port 8742"]
    end

    subgraph Edge["Vercel (api/health/v1/)"]
        EF_OUT["outbreaks<br/>(merge WHO + pipeline)"]
        EF_STATS["stats"]
        EF_NEWS["news"]
        EF_CLIMATE["climate"]
    end

    subgraph Client["Browser (Vercel app)"]
        subgraph Services["Services"]
            DS["DataService"]
            LS["LLMService"]
        end

        subgraph UI["UI Panels"]
            MAP["Map<br/>(deck.gl)"]
            PANELS["Outbreak / Stats / Chat / Climate"]
        end
    end

    WHO --> EF_OUT
    WEB --> EXT
    YT --> EXT
    FB --> EXT
    EXT --> DB
    DB --> API
    API --> EF_OUT
    EF_OUT --> DS
    OM --> EF_CLIMATE
    LLM_P -.->|SSE| LS
    DS --> PANELS
    DS --> MAP
    LS --> PANELS
```

**Tại sao Vanilla TypeScript?** Không cần React/Vue — app focus vào display + analysis, không cần component complexity. Bundle nhỏ ~60% hơn framework-based.

**Tại sao Vercel Edge Functions?** Merge WHO-DON + Mac Mini hotspots tại CDN edge, latency thấp. Vercel Cron (future) có thể poll Mac Mini 1h/lần.

**Tại sao Mac Mini pipeline riêng?** Vietnamese news crawl + extraction phức tạp, cần persistent browser (Playwright), SQLite store. Chạy launchd cron 6h, expose qua FastAPI + Cloudflare tunnel. Vercel chỉ call API, không crawl.

---

## Real Data Pipeline

### Tier 1: WHO-DON (Global, Vercel)
- **URL**: WHO Disease Outbreak News REST API
- **Processing**: Vercel Edge → extract disease, countries, severity
- **Items**: ~30-50 global items (low VN overlap)
- **Purpose**: Background signal, international context

### Tier 2: Mac Mini Hotspots (Vietnamese, FastAPI)
- **Source**: Crawl web (Google SERP), YouTube (transcript), Facebook (Playwright)
- **Keywords**: 20+ disease names in Vietnamese
- **Pipeline**: 
  ```
  Daily sources → Google SERP 3-day window → crawl4ai markdown
            ↓
  YouTube RSS (WHO/VTV24/CDC) → get-transcript.sh → MLX Whisper
            ↓
  Facebook pages + search → Playwright+Gemini Vision
            ↓
  extract-m27.py (MiniMax M2.7) → province/district/cases/deaths
            ↓
  db-store.py: validate (63 provinces), dedup (Jaccard 0.6), confidence ≥0.5
            ↓
  SQLite: outbreak_items + hotspots VIEW
            ↓
  db-api-server.py FastAPI → /hotspots?day=YYYY-MM-DD
            ↓
  Cloudflare Tunnel → EPIDEMIC_API_URL
  ```
- **Current**: 42 items across web/youtube/facebook (2026-04-05 snapshot)
- **Quality**: cases_type (cumulative vs outbreak), confidence 0.5-0.95

### Tier 3: Client-side Processing (Browser)
- **Disease normalization**: 67 aliases EN+VN
- **Dedup**: Jaccard 0.4 (news), 0.6 (outbreaks from Mac Mini)
- **IndexedDB**: 30-day snapshots for trend + historical
- **UI panels**: Map, stats, chat, climate alerts

**Architecture Note**: Display-only — data fetching delegated to Mac Mini + Vercel Edge. Browser never crawls or extracts.

---

## Luồng dữ liệu

```mermaid
sequenceDiagram
    participant API as External APIs
    participant EF as Edge Functions
    participant SVC as Client Services
    participant CTX as AppContext
    participant UI as Panels/Map

    Note over EF: Cache in-memory (server)
    API->>EF: Raw data (RSS/CSV/JSON)
    EF->>EF: Parse + normalize + cache
    EF-->>SVC: REST JSON response

    Note over SVC: Stale-while-revalidate (localStorage)
    SVC->>SVC: Check localStorage cache
    alt Cache valid
        SVC-->>CTX: Cached data (instant)
    else Cache expired
        SVC->>EF: Fetch fresh data
        EF-->>SVC: Fresh JSON
        SVC->>SVC: Update localStorage
        SVC-->>CTX: Fresh data
    end

    CTX->>UI: Data update
    UI->>UI: Re-render panels + map layers
```

**Tại sao stale-while-revalidate?** Người dùng thấy dữ liệu ngay lập tức từ cache, trong khi background fetch cập nhật. UX mượt mà hơn chờ loading mỗi lần mở app. Server cache (in-memory) tránh gọi lặp lại WHO/OWID; client cache (localStorage) cho phép offline-capable.

---

## Hệ thống Panel

Tất cả panels kế thừa từ `PanelBase` — một pattern giống Component nhưng không dùng framework.

```mermaid
stateDiagram-v2
    [*] --> Created: new Panel()
    Created --> Mounted: mount(container)
    Mounted --> Loading: showLoading()
    Loading --> DataReady: updateData(data)
    DataReady --> Rendered: _render()
    Rendered --> Loading: refresh / new data
    Rendered --> Collapsed: user toggle
    Collapsed --> Rendered: user expand
    DataReady --> Error: fetch failed
    Error --> Loading: retry
```

**Tại sao self-contained panels?** Mỗi panel fetch dữ liệu riêng và render độc lập — dễ thêm/xóa panel mà không ảnh hưởng panel khác. Panel có 3 state tự quản lý: loading / error / data. **Event Bus** thay thế prop drilling: panel phát `outbreak-selected` → bất kỳ component quan tâm tự lắng nghe, không cần callback chain.

---

## Bản đồ (Map System)

MapShell là wrapper tích hợp hai thư viện bản đồ khác nhau:

- **MapLibre GL**: Render vector tiles (basemap, đường, địa danh)
- **deck.gl**: WebGL layers trên cùng (markers, heatmap, choropleth)

**3 layer types:**

| Layer | Type | Dùng cho |
|-------|------|----------|
| ScatterplotLayer | Điểm tròn có màu | Vị trí ổ dịch |
| HeatmapLayer | Gradient mật độ | Phân bố ca bệnh |
| GeoJsonLayer | Polygon tô màu | Choropleth theo tỉnh |

**Tại sao deck.gl + MapLibre tách biệt?** MapLibre giỏi vector tiles nhưng hạn chế WebGL visualization; deck.gl ngược lại. Kết hợp qua `MapboxOverlay` adapter tận dụng điểm mạnh cả hai. Viewport khóa vào Vietnam (`maxBounds`, `minZoom 4`) vì đây là monitoring tool, không phải bản đồ thế giới.

---

## AI Assistant (LLM System)

```mermaid
graph LR
    subgraph Providers["LLM Providers"]
        OR["OpenRouter<br/>(cloud)"]
        OL["Ollama<br/>(local)"]
        MX["MLX<br/>(Apple Silicon)"]
    end

    subgraph Router["LLMService (Auto-detect)"]
        PING["Ping all providers<br/>→ use first available"]
        SYS["System Prompt Builder<br/>(inject live data)"]
        SSE["SSE Stream Handler"]
    end

    subgraph Pipeline["Data Pipeline"]
        NORM["Disease name normalizer"]
        ENT["Entity extractor"]
    end

    subgraph Output["Output"]
        CHAT["ChatPanel<br/>(streaming text)"]
        REPORT["CaseReport<br/>(structured JSON)"]
    end

    OR & OL & MX --> PING
    PING --> SYS
    SYS -->|"top 20 outbreaks + news"| SSE
    SSE --> CHAT

    NORM --> ENT --> REPORT
```

**Tại sao OpenAI-compatible API?** Ba provider dùng chung interface — switching provider = đổi base URL, không đổi code. **Inject live data vào system prompt** vì LLM không có real-time knowledge; đưa top 20 outbreaks + news vào context giúp AI trả lời chính xác hơn. **SSE** thay vì WebSocket: streaming một chiều đơn giản hơn, không cần persistent connection, tương thích Edge Functions stateless.

---

## Dự báo khí hậu (Climate Risk)

Open-Meteo cung cấp forecast 14 ngày miễn phí. ClimateService tính risk score theo công thức:

**Risk Score = f(temperature, rainfall, humidity) → [0, 1]**

| Bệnh | Điều kiện HIGH risk |
|------|---------------------|
| Dengue | 25-35°C + mưa >5mm/ngày + độ ẩm >70% |
| HFMD | >28°C + độ ẩm >80% |

**Tại sao tính risk trên client?** Công thức đơn giản, dữ liệu đã có — không cần thêm round-trip lên server. Edge Function chỉ fetch + cache raw weather data.

---

## Deployment

```mermaid
graph LR
    subgraph Dev["Development"]
        VD["Vite Dev Server<br/>localhost:5173"]
        API_LOCAL["Edge Functions<br/>(vercel dev)"]
    end

    subgraph Prod_V["Vercel (Production)"]
        CDN["CDN → Static assets"]
        EF_V["Edge Functions<br/>(auto-scaled)"]
    end

    subgraph Prod_D["Docker (Self-hosted)"]
        NG["nginx → static files"]
        EF_D["Node server → /api/*"]
    end

    VD --> CDN
    API_LOCAL --> EF_V
    VD --> NG
    API_LOCAL --> EF_D
```

**Vercel**: zero-config, edge functions tự scale, phù hợp demo/production nhanh. **Docker + nginx**: self-hosted cho môi trường yêu cầu data sovereignty. 15 Playwright E2E tests cover critical flows — E2E thay vì unit tests vì phần lớn logic là UI orchestration.

---

## Tóm tắt các quyết định kiến trúc

| Quyết định | Lựa chọn | Lý do |
|------------|----------|-------|
| Framework | Vanilla TS | Bundle nhỏ, không vendor lock-in |
| Bản đồ | MapLibre + deck.gl | Tách basemap vs WebGL visualization |
| Serverless | Vercel Edge | Latency thấp, gần user |
| LLM | OpenAI-compatible | Swap provider không đổi code |
| Cache | In-memory + localStorage | UX nhanh + giảm API calls |
| Streaming | SSE | Đơn giản hơn WebSocket cho one-way stream |
| Panel pattern | Self-contained | Fault isolation, dễ mở rộng |

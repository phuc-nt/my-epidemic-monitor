# International Data Sources — Bổ sung cho Epidemic Monitor

> Các nguồn API quốc tế có dữ liệu Việt Nam, xếp theo mức độ dễ tích hợp.

**Ngày**: 2026-04-04 | **Tác giả**: MK Agent (Research)

---

## Quick-Start (Tích hợp ngay, free, không cần auth)

### 1. disease.sh — COVID & Flu API

```
GET https://disease.sh/v3/covid-19/countries/Vietnam
GET https://disease.sh/v3/covid-19/historical/Vietnam?lastdays=30
```

| Thuộc tính | Giá trị |
|---|---|
| Vietnam data | YES |
| Auth | Không cần |
| Format | JSON |
| Freshness | Real-time (~10 phút) |
| Scope | COVID-19, influenza |
| Rate limit | Không giới hạn |

**Response mẫu:**
```json
{
  "country": "Vietnam",
  "cases": 10567429,
  "deaths": 43084,
  "recovered": 9614200,
  "active": 910145,
  "todayCases": 0,
  "todayDeaths": 0,
  "updated": 1712265600000
}
```

**Tích hợp**: Thêm vào `api/health/v1/` → panel mới hoặc merge vào StatsPanel.

### 2. WHO GHO OData API — 1000+ Health Indicators

```
GET https://ghoapi.azureedge.net/api/Indicator
GET https://ghoapi.azureedge.net/api/{INDICATOR_CODE}?$filter=SpatialDim eq 'VNM'
```

| Thuộc tính | Giá trị |
|---|---|
| Vietnam data | YES (filter: `SpatialDim eq 'VNM'`) |
| Auth | Không cần |
| Format | JSON (OData) |
| Freshness | Quarterly/Annual |
| Scope | TB, HIV, malaria, communicable diseases, 1000+ indicators |

**Useful indicators cho VN:**
- `WHS3_40` — TB incidence per 100k
- `WHS3_41` — Malaria cases
- `MDG_0000000003` — Maternal mortality
- `WHOSIS_000002` — Life expectancy

**Tích hợp**: Background data cho TrendChartPanel (dữ liệu lịch sử dài hạn).

### 3. WHO Disease Outbreak News (đã có, nâng cấp)

```
GET https://www.who.int/api/news/diseaseoutbreaknews
```

Đã implement trong `api/health/v1/outbreaks.ts`. Nâng cấp:
- Crawl4AI full article (thay vì chỉ RSS summary)
- M2.7 extract: cases, countries, severity
- Cross-reference với VN RSS sources

---

## Production-Grade (Cần setup, free tier hoặc subscription)

### 4. ProMED-mail — Outbreak Alerts (Mekong Region)

```
# Cần API key (đăng ký tại promedmail.org)
GET https://api.promedmail.org/v1/alerts
Authorization: Bearer <API_KEY>
```

| Thuộc tính | Giá trị |
|---|---|
| Vietnam data | YES (ProMED-MBDS = Mekong Basin) |
| Auth | API key (free tier web-only, API cần subscription) |
| Format | JSON |
| Freshness | Real-time (24/7, ~8 reports/ngày) |
| Scope | Tất cả infectious diseases |

**Tại sao quan trọng**: ProMED là hệ thống early warning #1 thế giới, được WHO và CDC sử dụng. Mekong Basin coverage bao gồm VN, Lào, Cambodia, Thailand, Myanmar.

**Alternative miễn phí**: RSS feed `https://promedmail.org/promed-rss/` hoặc email subscription.

### 5. HealthMap — Automated Multi-source Aggregation

```
Website: https://www.healthmap.org/
```

| Thuộc tính | Giá trị |
|---|---|
| Vietnam data | YES |
| Auth | Free web access |
| Format | Web-based (cần Crawl4AI scrape) |
| Freshness | Real-time |
| Sources | Google News + ProMED + official alerts + social media |

**Tích hợp qua Crawl4AI**:
```bash
python3 crawl-web.py markdown "https://www.healthmap.org/en/"
# Extract alerts mentioning Vietnam
```

### 6. Delphi Epidata — Research API (CMU)

```
GET https://api.delphi.cmu.edu/epidata/paho_dengue/?regions=VNM&epiweeks=202601
```

| Thuộc tính | Giá trị |
|---|---|
| Vietnam data | Partial (PAHO dengue có SE Asia data) |
| Auth | Không cần |
| Scope | COVID, Flu, Dengue |

---

## Vietnam-Specific (Không có public API, cần Crawl4AI)

### 7. HCDC (TP.HCM CDC)
- URL: `https://hcdc.vn/`
- Data: Thống kê dịch bệnh TP.HCM
- Tích hợp: Crawl4AI scrape → M2.7 extract structured data

### 8. NIHE / Vietnam CDC
- URL: `https://vncdc.gov.vn/`
- Data: Surveillance data cấp quốc gia
- Tích hợp: Crawl4AI scrape → M2.7 extract

### 9. Bộ Y tế
- URL: `https://moh.gov.vn/`
- Data: Thông báo chính thức, số liệu dịch bệnh
- Tích hợp: Crawl4AI → M2.7 extract → confidence: 1.0 (official)

---

## YouTube Health News Channels

| Channel | Channel ID | Focus | RSS Feed |
|---------|-----------|-------|----------|
| **WHO** | `UC07-dOwgza1IguKA86jqxNA` | Global outbreak alerts | `youtube.com/feeds/videos.xml?channel_id=UC07-dOwgza1IguKA86jqxNA` |
| **CDC** | `UCLPbTZMdjEU7xWLM-cMA3g` | Disease surveillance | `youtube.com/feeds/videos.xml?channel_id=UCLPbTZMdjEU7xWLM-cMA3g` |
| **VTV24** | `UCsWsEvLGB5cRYB6_L3ROPzA` | VN health/epidemic news | `youtube.com/feeds/videos.xml?channel_id=UCsWsEvLGB5cRYB6_L3ROPzA` |

**Pipeline**: YouTube RSS → filter health keywords → get-transcript.sh → M2.7 extract outbreak data → store.

---

## Recommended Integration Priority

| Priority | Source | Effort | Impact |
|----------|--------|--------|--------|
| P0 | disease.sh API | 2 giờ | COVID data real-time cho VN |
| P0 | YouTube RSS (WHO/VTV24) | 4 giờ | Video health news tab |
| P1 | WHO GHO OData | 4 giờ | Long-term health indicators |
| P1 | ProMED RSS (free) | 2 giờ | Regional outbreak alerts |
| P2 | HCDC/NIHE Crawl4AI | 1 ngày | Official VN data (cần monitor DOM changes) |
| P2 | HealthMap Crawl4AI | 4 giờ | Multi-source aggregated alerts |
| P3 | GIDEON API | Subscription | Comprehensive 350+ diseases |

---

## Cost Summary

| Source | Cost | Notes |
|--------|------|-------|
| disease.sh | $0 | Free forever |
| WHO APIs | $0 | Free |
| ProMED RSS | $0 | Free RSS/email |
| ProMED API | ~$20/month | Full API access |
| YouTube RSS | $0 | Free |
| Crawl4AI | $0 | Local |
| M2.7 extraction | ~$3.3/tháng | All LLM tasks combined |
| **Total (without ProMED API)** | **~$3.3/tháng** | |

# Data Sources Catalog — Epidemic Monitor

Tài liệu quản lý tất cả nguồn dữ liệu của hệ thống. Mỗi source ghi rõ: URL, loại dữ liệu, tần suất cập nhật, cách parse, giới hạn, và trạng thái.

---

## Tổng quan

| # | Source | Loại | Dữ liệu | Cache TTL | Trạng thái |
|---|--------|------|----------|-----------|------------|
| 1 | WHO DON | RSS/XML | Outbreak alerts toàn cầu | 5 phút | Active |
| 2 | WHO News | RSS/XML | Tin tức y tế toàn cầu | 15 phút | Active |
| 3 | WHO Vietnam | RSS/XML | Tin tức WHO khu vực VN | 15 phút | Active |
| 4 | Bộ Y tế VN (MOH) | RSS/XML | Tin tức y tế Việt Nam | 15 phút | Active |
| 5 | US CDC | RSS/XML | Tin tức CDC Hoa Kỳ | 15 phút | Active |
| 6 | ProMED-mail | RSS/XML | Early disease intelligence | 15 phút | Active |
| 7 | ECDC | RSS/XML | Dịch bệnh châu Âu | 15 phút | Active |
| 8 | ReliefWeb | RSS/XML | Báo cáo nhân đạo/y tế | 15 phút | Active |
| 9 | OWID | CSV/GitHub | COVID-19 data per country | 6 giờ | Active |

---

## 1. WHO Disease Outbreak News (DON)

- **URL**: `https://www.who.int/feeds/entity/don/en/rss.xml`
- **API file**: `api/health/v1/outbreaks.ts`
- **Client service**: `src/services/disease-outbreak-service.ts`
- **Loại**: RSS 2.0 XML
- **Dữ liệu**: Cảnh báo dịch bệnh toàn cầu — tên bệnh, quốc gia, mô tả, ngày công bố
- **Parse**: Regex XML (`<item>` → title, link, pubDate, description)
- **Xử lý**:
  - Tách `disease` và `country` từ title (pattern: "Disease - Country")
  - Derive `alertLevel`: "outbreak"/"emergency" → alert, "update" → warning, else → watch
  - Geocode: country name → ISO code → centroid lat/lng (static lookup 60+ countries)
  - VN sub-national: tìm tên tỉnh trong title/description → centroid 63 tỉnh
- **Cache**: 5 phút (server-side in-memory)
- **Rate limit**: Không rõ, ước tính ~100 req/min
- **Fallback**: Sample data 8 outbreaks VN khi API fail
- **Giới hạn**: Chỉ có outbreak-level data, không có case counts chính xác

---

## 2. WHO News (Global)

- **URL**: `https://www.who.int/rss-feeds/news-english.xml`
- **API file**: `api/health/v1/news.ts` (1 trong 7 feeds)
- **Loại**: RSS 2.0 XML
- **Dữ liệu**: Tin tức y tế toàn cầu — không chỉ dịch bệnh
- **Parse**: Regex XML, strip HTML tags từ description
- **Lưu ý**: Feed rộng, bao gồm cả non-epidemic news (NCD, policy, etc.)

---

## 3. WHO Vietnam

- **URL**: `https://www.who.int/vietnam/rss-feeds/news/rss.xml`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS 2.0 XML
- **Dữ liệu**: Tin tức WHO specific cho Việt Nam
- **Lưu ý**: Có thể trả về mix tiếng Anh + tiếng Việt. Feed nhỏ hơn global.

---

## 4. Bộ Y tế Việt Nam (MOH-VN)

- **URL**: `https://moh.gov.vn/rss/-/home`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS (có thể Atom hoặc RSS 2.0)
- **Dữ liệu**: Tin tức chính thức từ Bộ Y tế VN — dịch bệnh, chính sách, tiêm chủng
- **Ngôn ngữ**: Tiếng Việt
- **Rủi ro**: 
  - RSS format có thể không chuẩn
  - Server có thể block User-Agent không quen
  - Có thể cần header `Accept-Language: vi`
- **Fallback**: Skip nếu fail, vẫn có 6 feeds khác

---

## 5. US CDC Newsroom

- **URL**: `https://tools.cdc.gov/api/v2/resources/media/rss`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS 2.0 XML
- **Dữ liệu**: Tin tức CDC — outbreaks, travel notices, public health alerts
- **Lưu ý**: Focus Hoa Kỳ nhưng có global outbreaks. Feed lớn, nhiều items.

---

## 6. ProMED-mail

- **URL**: `https://promedmail.org/feed/`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS/XML
- **Dữ liệu**: Early disease intelligence — báo cáo sớm về dịch bệnh từ cộng đồng y tế
- **Giá trị**: Thường phát hiện outbreaks TRƯỚC WHO chính thức công bố
- **Rủi ro**:
  - Feed có thể không ổn định
  - Format thay đổi theo thời gian
  - Có thể cần authentication trong tương lai
- **Fallback**: Skip nếu fail

---

## 7. ECDC (European Centre for Disease Prevention and Control)

- **URL**: `https://www.ecdc.europa.eu/en/rss.xml`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS 2.0 XML
- **Dữ liệu**: Surveillance reports, rapid risk assessments châu Âu
- **Lưu ý**: Focus châu Âu nhưng có global disease updates

---

## 8. ReliefWeb (OCHA/UN)

- **URL**: `https://api.reliefweb.int/v1/reports?appname=epidemic-monitor&filter[field]=theme.name&filter[value]=Health&format=rss`
- **API file**: `api/health/v1/news.ts`
- **Loại**: RSS via REST API
- **Dữ liệu**: Báo cáo nhân đạo/y tế từ hệ thống UN — situation reports, assessments
- **Filter**: `theme.name=Health` chỉ lấy health-related
- **Lưu ý**: API ổn định, có rate limiting nhẹ. `appname` param bắt buộc.

---

## 9. Our World in Data (OWID)

- **URL**: `https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.csv`
- **API file**: `api/health/v1/owid.ts`
- **Client service**: `src/services/owid-data-service.ts`
- **Loại**: CSV (hosted trên GitHub)
- **Dữ liệu**: COVID-19 latest per country — total cases, deaths, vaccinations, per-million rates
- **Parse**: Split newlines → split commas → map headers
- **Xử lý**:
  - Exclude aggregate rows (iso_code starts with `OWID_`)
  - Sort: Vietnam first → Southeast Asia → rest by total_cases
  - Limit 50 countries
- **Cache**: 6 giờ (data cập nhật daily)
- **Fields used**: `location`, `iso_code`, `total_cases`, `total_deaths`, `total_cases_per_million`, `total_deaths_per_million`, `total_vaccinations_per_hundred`, `last_updated_date`
- **Giới hạn**: Chỉ có COVID-19, không có dengue/HFMD/cholera

---

## Data Flow Diagram

```
                    ┌─────────────────────────────────────────┐
                    │         Edge Functions (api/)            │
WHO DON RSS ───────►│ outbreaks.ts  → parse XML → geocode VN  │──► DiseaseOutbreaksPanel
                    │   cache: 5min                            │──► MapLayers (markers+heatmap)
                    │                                          │
WHO/CDC/ProMED ────►│ news.ts       → parse 7 RSS feeds       │──► NewsFeedPanel
ECDC/ReliefWeb     │   Promise.allSettled → merge → sort      │
MOH-VN/WHO-VN      │   cache: 15min                           │
                    │                                          │
OWID CSV ──────────►│ owid.ts       → parse CSV → sort VN     │──► (future: TrendChartPanel)
                    │   cache: 6hr                             │
                    │                                          │
(outbreaks.ts) ────►│ stats.ts      → aggregate from outbreaks│──► EpidemicStatisticsPanel
                    │   cache: 1hr                             │
                    │                                          │
(outbreaks.ts) ────►│ countries.ts  → group by country code   │──► CountryHealthPanel
                    │   cache: 30min                           │
                    └─────────────────────────────────────────┘
```

---

## Planned Sources (chưa implement)

| Source | URL | Dữ liệu | Priority |
|--------|-----|----------|----------|
| WHO GHO OData | `https://ghoapi.azureedge.net/api/` | Health indicators (mortality, incidence) | P2 |
| Vietnam HCDC | TBD | Số liệu dịch bệnh cấp tỉnh VN | P1 |
| Vietnam NIHE | TBD | Viện Vệ sinh Dịch tễ TW — surveillance data | P1 |
| OpenDisease.net | `https://opendisease.net/api/` | Aggregated disease data | P3 |
| HealthMap | `https://healthmap.org/` | Crowdsourced disease alerts | P3 |
| GPHIN | Restricted | Global Public Health Intelligence Network | P3 |

---

## Quản lý rủi ro

| Rủi ro | Ảnh hưởng | Xác suất | Mitigation |
|--------|-----------|----------|------------|
| WHO RSS thay đổi format | Outbreaks panel trống | Thấp | Validate XML structure, log parse errors |
| MOH-VN block requests | Mất nguồn VN chính | Trung bình | Rotate User-Agent, add delay, fallback |
| OWID repo deprecated | Mất COVID data | Thấp | Fork dataset, hoặc chuyển sang WHO GHO |
| Rate limiting | Responses chậm/fail | Trung bình | Cache aggressively, stale-while-revalidate |
| Feed unavailable | 1-2 news sources mất | Cao | Promise.allSettled — partial data OK |

---

## Notes
- Tất cả sources hiện tại đều **miễn phí, không cần API key**
- Edge functions proxy tất cả requests → không có CORS issues
- Sample data VN dùng khi dev mode (không có edge functions)
- Cần monitor uptime các RSS feeds — nếu feed die > 24h, cân nhắc thay thế

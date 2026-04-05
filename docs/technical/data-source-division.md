# Phân chia nhiệm vụ nguồn dữ liệu

> Mac Mini pipeline là nguồn dữ liệu chính và duy nhất cho outbreak data.
> Vercel là thin proxy + cache layer, không còn crawl hay parse data độc lập.

---

## Tổng quan phân chia

| Nhiệm vụ | Mac Mini (openclaw) | Vercel (epidemic-monitor) |
|----------|--------------------|-----------------------------|
| Crawl tin tức VN | ✅ web/YouTube/Facebook | ❌ |
| LLM extract outbreak | ✅ MiniMax M2.7 | ❌ |
| Validate + dedup | ✅ Jaccard 0.6, confidence ≥0.5 | ❌ |
| Lưu trữ lịch sử | ✅ SQLite | ❌ |
| Expose API | ✅ FastAPI | ❌ |
| Cache server-side | ❌ | ✅ in-memory 10-15 phút |
| UI rendering | ❌ | ✅ Vanilla TS + deck.gl |
| Dự báo khí hậu | ❌ | ✅ Open-Meteo proxy |
| OWID country stats | ❌ | ✅ CSV proxy |

---

## Mac Mini — FastAPI endpoints cần expose

### Hiện có

#### `GET /hotspots?day=YYYY-MM-DD`
Trả về danh sách outbreak hotspot đã qua LLM extract + validate.

**Response:**
```json
{
  "hotspots": [
    {
      "disease": "chickenpox",
      "province": "Dak Lak",
      "day": "2026-04-05",
      "peak_alert": "warning",
      "peak_cases": 12,
      "article_count": 3,
      "source_types": "web,youtube",
      "source_urls": "https://vnexpress.net/...|https://youtube.com/..."
    }
  ]
}
```

**Notes:**
- `disease`: English slug chuẩn hóa (`chickenpox`, `hand-foot-mouth`, v.v.)
- `province`: tên tỉnh tiếng Anh không dấu (Vercel lookup → lat/lng)
- `peak_alert`: `alert` | `warning` | `watch`
- `source_urls`: pipe-separated, Vercel lấy item đầu tiên làm link

---

### Cần implement thêm

#### `GET /news?limit=N`
Trả về danh sách tin tức sức khỏe gần đây từ pipeline (articles đã crawl).

**Request params:**
- `limit` (optional, default 50): số lượng items trả về

**Response:**
```json
{
  "items": [
    {
      "id": "unique-string-id",
      "title": "Tiêu đề bài báo",
      "source": "VnExpress",
      "url": "https://vnexpress.net/...",
      "publishedAt": 1712345678000,
      "summary": "Tóm tắt ngắn ≤300 ký tự (optional)",
      "imageUrl": "https://... (optional)",
      "category": "health (optional)"
    }
  ],
  "fetchedAt": 1712345678000
}
```

**Notes:**
- `id`: stable unique ID (e.g. hash của URL)
- `publishedAt`: Unix milliseconds
- Sort by `publishedAt` desc trước khi trả về
- Vercel sẽ fallback về RSS nếu endpoint này chưa có hoặc trả lỗi

---

## Vercel — Edge Function responsibilities

### `api/health/v1/outbreaks.ts`
- Gọi Mac Mini `/hotspots?day=TODAY`
- Lookup tỉnh → lat/lng (từ `VN_PROVINCES` table trong code)
- Translate disease slug → tên tiếng Việt (`diseaseLabel()`)
- Cache 10 phút
- Trả `[]` gracefully nếu Mac Mini offline (không throw)

### `api/health/v1/news.ts`
- **Primary**: gọi Mac Mini `/news?limit=50`
- **Fallback**: VN RSS feeds (VnExpress, Tuổi Trẻ, Thanh Niên) nếu Mac Mini offline/empty
- Cache 15 phút

### `api/health/v1/stats.ts`
- Derive từ `/outbreaks` response (không gọi thêm nguồn nào)
- Cache 1 giờ

### `api/health/v1/climate.ts`
- Gọi Open-Meteo API (không thay thế được, free)
- Cache riêng

### `api/health/v1/countries.ts` + `owid.ts`
- OWID CSV data cho country health stats
- Ít cập nhật, cache dài

---

## Data contract — disease slugs

Mac Mini phải dùng các slug chuẩn hóa dưới đây (Vercel lookup sang tên tiếng Việt):

| Slug | Tên tiếng Việt |
|------|----------------|
| `dengue` | Sốt xuất huyết (Dengue) |
| `hand-foot-mouth` | Tay chân miệng (HFMD) |
| `covid-19` | COVID-19 |
| `influenza` | Cúm (Influenza) |
| `measles` | Sởi (Measles) |
| `chickenpox` | Thủy đậu |
| `mumps` | Quai bị |
| `rabies` | Dại (Rabies) |
| `meningitis` | Viêm màng não |
| `diphtheria` | Bạch hầu (Diphtheria) |
| `pertussis` | Ho gà (Pertussis) |
| `typhoid` | Thương hàn (Typhoid) |
| `malaria` | Sốt rét (Malaria) |
| `cholera` | Tả (Cholera) |
| `ebola` | Ebola |
| `mpox` | Mpox (Đậu mùa khỉ) |
| `avian-influenza` | Cúm gia cầm |
| `hepatitis` | Viêm gan |
| `tuberculosis` | Lao (Tuberculosis) |
| `plague` | Dịch hạch |

> Nguồn chuẩn: `src/components/case-report-panel-data.ts` → `DISEASES[]`

---

## Data contract — province names

Mac Mini trả về tên tỉnh tiếng Anh không dấu. Vercel lookup sang lat/lng.

**Danh sách hợp lệ** (xem `VN_PROVINCES` trong `api/health/v1/outbreaks.ts`):
`Hanoi`, `Ho Chi Minh`, `Da Nang`, `Hai Phong`, `Can Tho`, `Dak Lak`, `Gia Lai`, `Khanh Hoa`, v.v. (63 tỉnh thành)

**Nếu tên không match chính xác**: Vercel thử partial match, fallback về Vietnam centroid `[16.05, 108.22]`.

---

## Authentication

Tất cả requests từ Vercel đến Mac Mini đều kèm header:
```
X-Api-Key: {EPIDEMIC_API_KEY}
```

Mac Mini FastAPI kiểm tra key này. Vercel lưu key trong Vercel environment variables.

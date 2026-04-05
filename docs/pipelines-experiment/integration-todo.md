# Integration TODO — my-epidemic-monitor side

> **Status**: Pipeline + DB bên OpenClaw đã **hoàn thiện, tested**. Bên này chỉ còn build webhook + merge logic.
> **Last updated**: 2026-04-05

---

## Architecture

```
┌─────────────────────────┐         HTTP POST         ┌──────────────────────────┐
│  Mac Mini (OpenClaw)    │ ─────────────────────────→│ my-epidemic-monitor      │
│                         │  DiseaseOutbreakItem[]    │                          │
│  SQLite DB              │                           │ 1. /api/pipeline-webhook │
│  ~/.openclaw/pipelines/ │                           │    (validate + store KV) │
│  epidemic-monitor/db/   │                           │                          │
│                         │                           │ 2. Vercel KV             │
│  cron 12h → run-all.sh  │                           │    key=pipeline:latest   │
│              │          │                           │    TTL 24h               │
│              ▼          │                           │                          │
│  db-export.py           │                           │ 3. /api/health/v1/       │
│  (--since-hours 24      │                           │    outbreaks.ts          │
│   --min-conf 0.5)       │                           │    merge KV + RSS        │
│              │          │                           │                          │
│              ▼          │                           │ 4. Client UI             │
│  db-sync.sh ────────────┼──────POST────────────────→│    (existing panels)     │
└─────────────────────────┘                           └──────────────────────────┘
```

**Mac Mini side đã xong**:
- ✅ SQLite schema match `DiseaseOutbreakItem`
- ✅ 3 pipelines tested (web/YT/FB)
- ✅ Dedup: Jaccard 0.6 + same province + same disease
- ✅ Confidence gate ≥ 0.5
- ✅ Export → DiseaseOutbreakItem JSON

**Bên này cần làm** (4 tasks, ước ~2-4h code):
1. Enable Vercel KV
2. Build `/api/pipeline-webhook`
3. Merge logic in `/api/health/v1/outbreaks.ts`
4. UI badge cho pipeline sources

---

## Task 1 — Enable Vercel KV

**Why**: Lưu latest pipeline snapshot, edge-accessible, TTL 24h.

```bash
# In my-epidemic-monitor repo
vercel link  # nếu chưa
vercel kv create epidemic-pipeline-cache
```

Auto-add env vars vào Vercel project:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

**Free tier**: 30K commands/month, 256MB — dư xài.

Install package:
```bash
npm install @vercel/kv
```

---

## Task 2 — Build `/api/pipeline-webhook`

**File**: `api/pipeline-webhook.ts` (new Edge route)

```typescript
import { kv } from '@vercel/kv';
import type { DiseaseOutbreakItem } from '@/types';

export const runtime = 'edge';

const SYNC_TOKEN = process.env.PIPELINE_SYNC_TOKEN!;
const KV_KEY = 'pipeline:latest';
const KV_TTL_SECONDS = 24 * 60 * 60; // 24h

interface PipelinePayload {
  exportedAt: number;
  windowHours: number;
  minConfidence: number;
  count: number;
  outbreaks: DiseaseOutbreakItem[];
}

export async function POST(req: Request) {
  // Auth
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${SYNC_TOKEN}`) {
    return new Response('unauthorized', { status: 401 });
  }

  // Parse + validate
  let payload: PipelinePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  if (!Array.isArray(payload.outbreaks)) {
    return new Response('missing outbreaks[]', { status: 400 });
  }

  // Basic schema validation (let merge logic handle the rest)
  const valid = payload.outbreaks.filter(o =>
    o.id && o.disease && o.alertLevel && o.url
  );

  // Store latest snapshot
  await kv.set(KV_KEY, {
    exportedAt: payload.exportedAt,
    storedAt: Date.now(),
    count: valid.length,
    outbreaks: valid,
  }, { ex: KV_TTL_SECONDS });

  return Response.json({
    ok: true,
    received: payload.outbreaks.length,
    stored: valid.length,
    rejected: payload.outbreaks.length - valid.length,
  });
}
```

**Env**: Thêm `PIPELINE_SYNC_TOKEN` (random 32-char string) vào Vercel + `.env.local`:
```
PIPELINE_SYNC_TOKEN=<generate: openssl rand -hex 32>
```

Share token này với Mac Mini cron side.

---

## Task 3 — Merge vào `/api/health/v1/outbreaks.ts`

Bổ sung vào pipeline hiện tại:

```typescript
// Existing: WHO-DON + VN RSS
const rssOutbreaks = await fetchRssOutbreaks();

// NEW: fetch pipeline snapshot from KV
import { kv } from '@vercel/kv';
const snapshot = await kv.get<{ outbreaks: DiseaseOutbreakItem[] }>('pipeline:latest');
const pipelineOutbreaks = snapshot?.outbreaks || [];

// Merge (existing logic already handles dedup via hashString(url) + Jaccard)
const allOutbreaks = [...rssOutbreaks, ...pipelineOutbreaks];
const deduped = dedupByTitleSimilarity(allOutbreaks, 0.4); // existing fn

return Response.json({
  outbreaks: deduped,
  fetchedAt: Date.now(),
  sources: [
    ...existingSources,
    ...(snapshot ? ['pipeline:mac-mini'] : []),
  ],
});
```

**Dedup**: `src/services/llm-data-pipeline.ts` đã có `processOutbreaks()` xử lý Jaccard + LLM tier 2. Pipeline items tự chạy qua logic này sau khi merge.

---

## Task 4 — UI Badge (optional but nice)

Trong `DiseaseOutbreakCard.tsx` (hoặc tương tự), add badge:

```tsx
const sourceType = item.source?.split(':')[0]; // 'web' | 'youtube' | 'facebook' | 'rss'
const isPipelineSource = ['web', 'youtube', 'facebook'].includes(sourceType);

{isPipelineSource && (
  <Badge variant="outline" className="ml-2">
    {sourceType === 'youtube' && '📺'}
    {sourceType === 'web' && '🌐'}
    {sourceType === 'facebook' && '📘'}
    +LLM
  </Badge>
)}
```

Pipeline items có `source` format `"web:tuoitre.vn"`, `"youtube:youtu.be"`, `"facebook:facebook.com"` → dễ parse.

Sort: pipeline items có thể có `meta.confidence` (nếu export giữ field) → sort desc khi alertLevel equal.

---

## API Contract (Mac Mini → this side)

### Request

```http
POST /api/pipeline-webhook HTTP/1.1
Host: my-epidemic-monitor.vercel.app
Authorization: Bearer <PIPELINE_SYNC_TOKEN>
Content-Type: application/json

{
  "exportedAt": 1775350259005,
  "windowHours": 24,
  "minConfidence": 0.5,
  "count": 9,
  "outbreaks": [
    {
      "id": "bb98224a55e1e617",
      "disease": "hand-foot-mouth",
      "country": "Vietnam",
      "countryCode": "VN",
      "alertLevel": "alert",
      "title": "Báo Thanh Niên - Bệnh tay chân miệng và sốt xuất huyết gia tăng mạnh tại Cần Thơ",
      "summary": "Bệnh tay chân miệng và sốt xuất huyết gia tăng mạnh tại Cần Thơ.",
      "url": "https://www.facebook.com/thanhnien/posts/...",
      "publishedAt": 1775350232510,
      "source": "facebook:facebook.com",
      "lat": 10.0452,
      "lng": 105.7469,
      "province": "Cần Thơ",
      "meta": {
        "confidence": 0.7,
        "sourceType": "facebook"
      }
    }
  ]
}
```

### Response (success)

```json
{ "ok": true, "received": 9, "stored": 9, "rejected": 0 }
```

### Response (401 unauth)

```
unauthorized
```

---

## Testing Checklist

- [ ] Deploy webhook route, verify `POST /api/pipeline-webhook` responds 200 with valid token
- [ ] Verify 401 with wrong token
- [ ] Verify 400 with malformed JSON
- [ ] Call webhook manually with sample payload:
  ```bash
  curl -X POST https://my-epidemic-monitor.vercel.app/api/pipeline-webhook \
    -H "Authorization: Bearer $PIPELINE_SYNC_TOKEN" \
    -H "Content-Type: application/json" \
    -d @sample-outputs/web-tay-chan-mieng.json  # wrap trong {outbreaks:[...]} first
  ```
- [ ] Verify `kv get pipeline:latest` returns stored data
- [ ] Test `/api/health/v1/outbreaks` trả merged data
- [ ] Verify dedup: same outbreak từ RSS + pipeline → 1 item trong response
- [ ] UI: pipeline badge hiển thị đúng source type

---

## Security Notes

1. **Token rotation**: Rotate `PIPELINE_SYNC_TOKEN` nếu lộ (update Vercel env + Mac Mini side)
2. **Rate limit**: Vercel Edge tự rate-limit, nhưng consider adding explicit check nếu scale
3. **Validate disease names**: Pipeline có thể submit disease names mới → optionally normalize via existing 166-alias DB
4. **KV quotas**: 30K commands/month = ~1000/day = ~42/hour — dư cho 12h cron

---

## Monitoring

Thêm endpoint để check status:

```typescript
// api/admin/pipeline-status.ts
export async function GET() {
  const latest = await kv.get<any>('pipeline:latest');
  if (!latest) return Response.json({ healthy: false, reason: 'no data' });

  const ageMs = Date.now() - latest.storedAt;
  const ageHours = ageMs / 3600_000;

  return Response.json({
    healthy: ageHours < 24,
    lastSyncAgo: `${ageHours.toFixed(1)}h`,
    itemCount: latest.count,
    exportedAt: new Date(latest.exportedAt).toISOString(),
  });
}
```

---

## Files to Create (this side)

1. `api/pipeline-webhook.ts` — webhook endpoint (~50 LoC)
2. `api/admin/pipeline-status.ts` — monitoring (~20 LoC)
3. Update `api/health/v1/outbreaks.ts` — merge KV data (~10 LoC add)
4. Update `.env.local` + Vercel env → add `PIPELINE_SYNC_TOKEN`
5. Update `src/components/DiseaseOutbreakCard.tsx` — pipeline badge (~15 LoC)

**Total effort estimate**: 2-4 hours dev + testing.

---

## Deployment Sequence

1. Create Vercel KV + env vars (5 min)
2. Deploy webhook endpoint (30 min code + deploy)
3. Mac Mini side: add db-sync.sh + cron (10 min, đã có sẵn pipeline)
4. First sync test (5 min)
5. Update outbreaks.ts + UI (1-2 hours)
6. Monitor 24h, check `/api/admin/pipeline-status` healthy

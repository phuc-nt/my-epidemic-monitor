# Devlog 2026-04-04 — My-Agent-Kit Best Practices

## Tổng quan
Ghi lại kinh nghiệm sử dụng bộ công cụ MK (my-agent-kit) trong quá trình build Epidemic Monitor MVP. Focus vào patterns hiệu quả và anti-patterns tránh.

---

## 1. Chiến lược phân bổ Agent

### Pattern hiệu quả: Phân tích → Plan → Implement song song

```
[Explore agents] → [planner agent] → [fullstack-developer agents song song]
                                   → [tester agent] → [code-reviewer agent]
```

**Thực tế trong session:**
1. Dispatch 2 Explore agents song song phân tích worldmonitor
2. Planner agent tạo 8-phase plan dựa trên analysis
3. 2 fullstack-developer agents song song: Phase 3+6 (API/services) và Phase 4+5 (panels/map)
4. Tester agent chạy E2E browser tests
5. Main agent handle styling + deployment + integration

### Anti-pattern: Dispatch quá nhiều agents cùng lúc
- Explore agents bị rate limit khi dispatch 2 cái cùng lúc
- **Bài học**: Check system resources trước khi spawn. 2 agents là safe, 3+ có risk

### Pattern: File Ownership rõ ràng
Mỗi fullstack-developer agent nhận danh sách files cụ thể:
```
Agent A: api/*, src/services/*, src/components/news-feed-panel.ts
Agent B: src/components/*(except news), src/app/app-context.ts, src/app/app-init.ts
```
**Kết quả**: Không có file conflict, cả 2 agent merge sạch.

---

## 2. Prompt Engineering cho Agents

### Effective Prompt Structure
```
## Task (1-2 sentences)
## Environment (OS, paths, Node version)
## Existing Code State (what's already built)
## YOUR FILE OWNERSHIP (explicit list)
## Detailed specs per file
## IMPORTANT RULES (compile check, naming, no mocks)
```

### Key Rules trong prompt:
- **"After creating all files, run `npx tsc --noEmit`"** — bắt agent self-verify
- **"Fix any TypeScript errors before reporting done"** — prevent incomplete delivery
- **"Use @/ import alias everywhere"** — maintain consistency
- **"Each file under 200 lines"** — enforce modularization

### Anti-pattern: Prompt quá dài
- Tránh paste toàn bộ phase plan vào prompt
- Tóm tắt key decisions, list specific files + specs
- Agent có 200K context — nhưng dài quá → mất focus

---

## 3. Agent Selection Guide

| Task | Agent Type | Tại sao |
|------|-----------|---------|
| Phân tích codebase lớn | `Explore` | Quick search, không edit files |
| Tạo implementation plan | `planner` | Research + plan output structured |
| Implement code | `fullstack-developer` | Full toolset: write + bash + test |
| Chạy tests | `tester` | Focused on test execution + reporting |
| Review code | `code-reviewer` | Quality + security analysis |
| Debug | `debugger` | Root cause analysis |

### Khi KHÔNG dùng agent:
- Edit 1-2 files → dùng Edit tool trực tiếp
- Grep/search đơn giản → dùng Grep/Glob trực tiếp
- Quick fix → tự làm nhanh hơn spawn agent

---

## 4. Parallel vs Sequential

### Parallel (dispatch cùng lúc):
- **Khi nào**: Tasks độc lập, files không overlap
- **Ví dụ**: Phase 3+6 (API) || Phase 4+5 (UI) — khác layer hoàn toàn
- **Cách**: Gửi 1 message với 2 Agent tool calls

### Sequential (chờ xong rồi tiếp):
- **Khi nào**: Output agent trước là input agent sau
- **Ví dụ**: Explore → planner (planner cần analysis results)
- **Ví dụ**: Implement → tester (tester cần code đã viết)

### Hybrid (tốt nhất):
- Dispatch background agents, tự làm tasks khác trong lúc chờ
- **Ví dụ**: Dispatch 2 implement agents background → tự viết deployment config + README

---

## 5. Handling Agent Conflicts

### Problem: 2 agents edit cùng file
**Solution**: Strict file ownership trong prompt. List rõ "do NOT touch files outside this list".

### Problem: Agent tạo stub mà agent khác đã tạo real implementation
**Ví dụ**: Agent B tạo `outbreak-data-service.ts` stub, Agent A đã tạo `disease-outbreak-service.ts` thực
**Solution**: Cleanup sau khi cả 2 xong. `rm` unused stub.

### Problem: Agent dùng API chưa tồn tại
**Solution**: Prompt agent dùng `try/catch` hoặc dynamic import. Service stubs là OK.

---

## 6. Browser Testing Pattern

### Playwright direct > agent-browser cho automated testing
```ts
// Playwright node script — reliable, synchronous output
node -e "
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(5000);
  const rows = await page.locator('.outbreak-row').count();
  console.log('Rows:', rows);
  await page.screenshot({ path: '/tmp/screenshot.png' });
  await browser.close();
})();
"
```

### agent-browser: tốt cho interactive exploration, KHÔNG tốt cho scripted testing
- `eval` commands chạy background, output khó parse
- `snapshot` commands cũng background
- Dùng cho: visual check, interactive debug
- KHÔNG dùng cho: automated assertions

---

## 7. Sample Data Pattern

### Vấn đề: Dev mode không có backend → panels trống
### Giải pháp: Sample data fallback

```ts
// app-init.ts
try {
  [outbreaks, stats, news] = await Promise.all([...API calls...]);
  if (!outbreaks.length) outbreaks = SAMPLE_OUTBREAKS;  // API returned empty
} catch {
  outbreaks = SAMPLE_OUTBREAKS;  // API unavailable
}
```

**Lợi ích:**
- Dev experience tốt — thấy UI đầy đủ ngay lập tức
- Không cần mock server hay env setup
- Sample data = documentation cho data format

---

## 8. Map Basemap Selection

### Decision matrix:
| Provider | Free | API Key | Vector | Dark | Quality |
|----------|------|---------|--------|------|---------|
| CartoDB dark-matter | Yes | No | Mixed | Yes | Medium (raster-ish) |
| OpenFreeMap | Yes | No | Yes | Yes | High |
| MapTiler | Freemium | Yes | Yes | Yes | Very High |
| Mapbox | No | Yes | Yes | Yes | Highest |

**Chọn OpenFreeMap**: Free, no key, vector tiles sắc nét, fallback CartoDB.

### Pitfall: `pixelRatio` override
- MapLibre tự handle `devicePixelRatio`
- Force override → break event coordinates → drag/zoom không hoạt động
- **Rule**: Không set `pixelRatio` trừ khi có lý do cụ thể

---

## 9. P0 Feature Implementation — Agent Orchestration

### 3 features song song, zero conflicts
Dispatch 2 fullstack-developer agents + tự code 1 feature:
- **Agent A**: Climate Predictive Alerts (4 files: API + service + panel + CSS)
- **Agent B**: Case Report Form (4 files: panel + data + service + CSS)
- **Main**: Map time filter (edit 2 existing files)

**Kết quả**: 11 files mới, compile clean, zero file conflicts, integrate trong 5 phút.

### Pattern: Feature = isolated file set
Mỗi feature mới = {API, service, panel, CSS} — 4 files độc lập. Agent nhận ownership 4 files đó, không chạm files khác. Main agent wire vào app-init.ts sau.

### Pattern: Tester agent chạy + fix lint
Tester agent không chỉ test — nó cũng fix lint issues tìm thấy (isNaN → Number.isNaN, unused vars, template literals). Saves round-trip.

---

## 10. Data Optimization — Main Agent vs Agents

### Khi nào tự code (không dispatch agent)?
- **Sửa 1-3 files liên quan chặt** → tự làm nhanh hơn agent spawn+wait
- **Ví dụ**: thêm CSS classes, fix test assertions, wire vào app-init
- **Ví dụ**: expand alias table từ 14→67 entries — đơn giản, repetitive, không cần agent

### Khi nào dispatch agent?
- **Feature mới cần 4+ files** (API + service + panel + CSS)
- **Research** (tìm GeoJSON source, competitive analysis)
- **Test suite chạy + fix** (tester agent tự fix lint)

### Autoresearch pattern (normalization 29%→100%)
1. Tạo metric script (`measure-normalization.mjs`) — output single number
2. Đo baseline: 29%
3. Expand DISEASE_ALIASES: 14→67, thêm VN aliases, fix match order
4. Re-measure: 100%
5. Commit with metric in message

**Key insight**: Metric-driven optimization hiệu quả hơn "make it better" vì có objective target.

---

## 11. Full Session Stats (Final)

| Metric | Value |
|--------|-------|
| Total agents dispatched | ~20 |
| Agent types used | Explore, planner, fullstack-developer, tester, researcher |
| Parallel dispatches | 7 rounds (2-3 agents/round) |
| File conflicts | 0 |
| Manual fixes after agents | ~8 (type mismatches, DOM wipe, test assertions, wiring) |
| Total session time | ~8 hours (06:47 → ~17:00) |
| Files created by agents | ~50 |
| Files created/edited by main | ~20 |
| Final codebase | 52 TS files, 4774 lines, 25 E2E tests |

---

## 12. Lessons Learned (Final — 16 items)

1. **Explore agents dễ bị rate limit** — dùng Grep/Glob trực tiếp cho searches đơn giản
2. **File ownership = zero conflicts** — luôn list files cho mỗi agent
3. **Self-verify trong prompt** — "run tsc --noEmit before reporting done"
4. **Sample data > empty state** — dev experience quan trọng
5. **Playwright direct > agent-browser** — cho automated testing
6. **CSS cần tập trung** — base.css cho shared, feature.css cho từng panel
7. **maxBounds + minZoom** — cách tốt nhất lock map vào region
8. **showLoading() wipes DOM** — panels với persistent DOM elements cần re-mount pattern
9. **Vector tiles >>> raster tiles** — sắc nét ở mọi zoom level
10. **Feature = 4-file bundle** (API + service + panel + CSS) → perfect for agent ownership
11. **Tester agent fix lint too** — saves round-trip, let tester own lint fixes
12. **Layout bugs need real viewport testing** — Playwright với explicit viewport size
13. **Wire new panels cuối cùng** — agents tạo isolated files, main agent integrate
14. **Metric script trước khi optimize** — đo baseline, set target, verify sau mỗi change
15. **Small edits: tự làm > dispatch agent** — 1-3 file edits không cần agent overhead
16. **Researcher agent cho external data** — tìm GeoJSON, API docs, competitive analysis hiệu quả

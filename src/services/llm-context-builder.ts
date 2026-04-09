/**
 * LLM context builder — constructs system prompts from live epidemic data.
 *
 * Reads from the shared app context singleton (ctx). ctx.outbreaks is
 * already populated by /api/health/v1/all which returns the last 7 days
 * from the D1 hotspots VIEW. So the AI sees the same 7-day window the
 * user sees on screen.
 */

import { ctx } from '@/app/app-context';
import { diseaseLabel } from '@/components/case-report-panel-data';
import type { ChatMessage } from '@/types/llm-types';

/** Format outbreak for LLM context with full location + temporal detail. */
function formatOutbreak(o: typeof ctx.outbreaks[number]): string {
  const locParts = [];
  if (o.district) locParts.push(o.district);
  if (o.province && o.province !== o.country) locParts.push(o.province);
  const location = locParts.length ? locParts.join(', ') : o.country;

  const day = new Date(o.publishedAt).toISOString().slice(0, 10);
  const casesPart = o.cases != null ? ` — ${o.cases.toLocaleString()} ca` : '';
  const deathsPart = o.deaths != null ? `, ${o.deaths} tử vong` : '';
  const label = diseaseLabel(o.disease);

  return `- [${day}] [${o.alertLevel.toUpperCase()}] ${label} tại ${location}${casesPart}${deathsPart}`;
}

/**
 * Build a system prompt grounded in the last 7 days of outbreak data from D1.
 * Sorts by alert level (alert > warning > watch) then by date (newest first).
 */
export function buildSystemPrompt(): string {
  const ALERT_RANK: Record<string, number> = { alert: 3, warning: 2, watch: 1 };

  // Use ALL outbreaks (already 7-day window from D1), sort by severity + date
  const outbreaks = [...ctx.outbreaks].sort((a, b) => {
    const rankDiff = (ALERT_RANK[b.alertLevel] ?? 0) - (ALERT_RANK[a.alertLevel] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return b.publishedAt - a.publishedAt;
  });

  // Aggregate stats for context
  const totalOutbreaks = outbreaks.length;
  const alertCount = outbreaks.filter(o => o.alertLevel === 'alert').length;
  const warningCount = outbreaks.filter(o => o.alertLevel === 'warning').length;
  const totalCases = outbreaks.reduce((s, o) => s + (o.cases ?? 0), 0);

  // Disease frequency
  const diseaseCount = new Map<string, number>();
  for (const o of outbreaks) {
    diseaseCount.set(o.disease, (diseaseCount.get(o.disease) ?? 0) + 1);
  }
  const topDiseases = Array.from(diseaseCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([d, c]) => `${diseaseLabel(d)} (${c})`)
    .join(', ');

  const outbreakLines = outbreaks.length
    ? outbreaks.map(formatOutbreak).join('\n')
    : '- Báo chí Việt Nam không đưa tin nào về dịch bệnh trong 7 ngày qua.';

  const today = new Date().toISOString().slice(0, 10);

  return `Bạn là trợ lý theo dõi tin tức dịch bệnh ở Việt Nam.

QUAN TRỌNG: Bạn KHÔNG phải cơ quan y tế. Bạn chỉ tổng hợp lại những gì
báo chí Việt Nam đã đưa tin. Mọi câu trả lời phải được phrasing dưới
dạng "báo chí đưa tin", "theo bài báo", "có ${totalOutbreaks} tin được
ghi nhận", KHÔNG dùng các từ "ổ dịch", "bùng phát", "cảnh báo dịch",
"công bố dịch" như thể đó là thông tin chính thức.

Dữ liệu dưới đây là TOÀN BỘ tin báo chí Việt Nam được tổng hợp trong
7 ngày gần nhất tính tới ${today}, được crawl từ các báo lớn (Tuổi Trẻ,
VnExpress, Dân Trí, Thanh Niên, Sức khỏe Đời sống...) và được trích
xuất tự động bởi AI.

## Tổng quan
- Tổng số tin: ${totalOutbreaks}
- Mức độ cao (nhiều tin): ${alertCount} | Mức độ trung bình: ${warningCount}
- Tổng số ca được báo chí đề cập (chưa xác minh độc lập): ${totalCases.toLocaleString('vi-VN')}
- Bệnh được nhắc nhiều: ${topDiseases || 'không có'}

## Chi tiết tin (7 ngày, sắp xếp theo mức độ + thời gian)
${outbreakLines}

## Quy tắc trả lời
- Chỉ trả lời dựa trên dữ liệu trên. Không bịa số liệu, không dùng kiến thức ngoài.
- Phrase câu trả lời như "báo X đưa tin về...", "có Y tin về...". KHÔNG nói "có ổ dịch", "đang bùng phát".
- Khi nhắc số ca, luôn kèm "(theo báo chí, chưa xác minh độc lập)".
- Trả lời bằng tiếng Việt nếu user hỏi tiếng Việt.
- Nếu dữ liệu không đủ để trả lời, nói rõ "Dữ liệu hiện không có thông tin về..." và gợi ý user kiểm tra Bộ Y tế / CDC tỉnh.
- Format: markdown gọn (bold, list, table) khi phù hợp.
- Ngắn gọn, súc tích, không dài dòng.
- Cuối câu trả lời quan trọng, nhắc người dùng "Đây là thông tin tham khảo từ báo chí, vui lòng đối chiếu với Bộ Y tế hoặc CDC địa phương trước khi ra quyết định."`;
}

/**
 * Assemble the full messages array for a chat completion request.
 * Prepends a fresh system prompt and appends the latest user message.
 *
 * @param userMessage - The user's current input.
 * @param history     - Prior conversation turns (system prompt excluded).
 */
export function buildMessages(userMessage: string, history: ChatMessage[]): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userMessage },
  ];
}

/**
 * LLM context builder — constructs system prompts from live epidemic data.
 *
 * Reads from the shared app context singleton (ctx) so the AI always
 * receives the most recent data without any additional fetch calls.
 */

import { ctx } from '@/app/app-context';
import type { ChatMessage } from '@/types/llm-types';

const MAX_OUTBREAKS = 20;
const MAX_NEWS = 15;

/**
 * Build a system prompt grounded in the current outbreak and news data.
 * Keeps the prompt deterministic and concise to stay within context limits.
 */
export function buildSystemPrompt(): string {
  const outbreaks = ctx.outbreaks.slice(0, MAX_OUTBREAKS);
  const news = ctx.news.slice(0, MAX_NEWS);

  const outbreakLines = outbreaks.length
    ? outbreaks
        .map((o) => {
          const casesPart = o.cases != null ? ` — ${o.cases} cases` : '';
          const deathsPart = o.deaths != null ? `, ${o.deaths} deaths` : '';
          return `- ${o.disease} in ${o.country} [${o.alertLevel.toUpperCase()}]${casesPart}${deathsPart}`;
        })
        .join('\n')
    : '- No active outbreaks on record.';

  const newsLines = news.length
    ? news.map((n) => `- [${n.source}] ${n.title}`).join('\n')
    : '- No recent news available.';

  return `You are an epidemic monitoring assistant for Vietnam.
You have access to the following real-time data:

## Active Outbreaks (${outbreaks.length})
${outbreakLines}

## Recent News
${newsLines}

Rules:
- Answer based ONLY on the data above.
- If data is insufficient, say so clearly.
- Respond in the same language as the user's question.
- Be concise and factual.
- When comparing regions, use specific numbers from the data.`;
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

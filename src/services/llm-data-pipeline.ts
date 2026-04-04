/**
 * LLM-powered data pipeline — automatic cleanup and transform on each data fetch.
 * Runs in background after outbreak/news data arrives.
 * Falls back to regex/rule-based when LLM unavailable.
 */

import type { DiseaseOutbreakItem, NewsItem } from '@/types';

// Cache processed results to avoid re-calling LLM for same input
const _processedCache = new Map<string, unknown>();

import type { ChatMessage } from '@/types/llm-types';

/** LLM complete function — set by app-init when LLM is available */
let _completeFn: ((msgs: ChatMessage[]) => Promise<string>) | null = null;

export function setLLMComplete(fn: typeof _completeFn): void {
  _completeFn = fn;
}

// ---------------------------------------------------------------------------
// Public API — called after each data fetch
// ---------------------------------------------------------------------------

/** Clean and enrich outbreak data. Modifies items in-place. */
export async function processOutbreaks(outbreaks: DiseaseOutbreakItem[]): Promise<void> {
  for (const o of outbreaks) {
    // Normalize disease name (rule-based, fast)
    o.disease = normalizeDiseaseNameRule(o.disease);
    // Clean summary (strip leftover HTML, normalize whitespace)
    o.summary = cleanText(o.summary);
  }

  // LLM enrichment — batch extract missing fields if LLM available
  if (_completeFn) {
    const needsEnrich = outbreaks.filter(o => !o.cases && !_processedCache.has(o.id));
    if (needsEnrich.length > 0) {
      await enrichOutbreaksBatch(needsEnrich);
    }
  }
}

/** Clean news items. Modifies items in-place. */
export async function processNews(news: NewsItem[]): Promise<void> {
  for (const n of news) {
    n.title = cleanText(n.title);
    if (n.summary) n.summary = cleanText(n.summary);
  }

  // LLM dedup — find duplicate stories across sources
  if (_completeFn && news.length > 5) {
    await markDuplicateNews(news);
  }
}

// ---------------------------------------------------------------------------
// Rule-based transforms (always available, fast)
// ---------------------------------------------------------------------------

const DISEASE_ALIASES: Record<string, string> = {
  'dengue fever': 'Sốt xuất huyết (Dengue)',
  'dengue': 'Sốt xuất huyết (Dengue)',
  'covid-19': 'COVID-19',
  'covid': 'COVID-19',
  'coronavirus': 'COVID-19',
  'influenza': 'Cúm (Influenza)',
  'influenza a': 'Cúm A (Influenza A)',
  'hand, foot and mouth': 'Tay chân miệng (HFMD)',
  'hfmd': 'Tay chân miệng (HFMD)',
  'measles': 'Sởi (Measles)',
  'cholera': 'Tả (Cholera)',
  'mpox': 'Đậu mùa khỉ (Mpox)',
  'avian influenza': 'Cúm gia cầm (Avian Influenza)',
  'rabies': 'Dại (Rabies)',
  'typhoid': 'Thương hàn (Typhoid)',
  'malaria': 'Sốt rét (Malaria)',
};

function normalizeDiseaseNameRule(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [alias, normalized] of Object.entries(DISEASE_ALIASES)) {
    if (lower.includes(alias)) return normalized;
  }
  return name; // Return original if no match
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')           // Strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')             // Collapse whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// LLM-powered enrichment (optional, runs when LLM available)
// ---------------------------------------------------------------------------

async function enrichOutbreaksBatch(items: DiseaseOutbreakItem[]): Promise<void> {
  if (!_completeFn) return;

  // Batch up to 5 items per LLM call
  const batch = items.slice(0, 5);
  const prompt = `Extract case counts from these outbreak summaries. Return JSON array.
Each entry: { "id": "...", "cases": number|null, "deaths": number|null }

${batch.map((o, i) => `[${i}] id="${o.id}" — ${o.summary.slice(0, 150)}`).join('\n')}

Return ONLY valid JSON array, no explanation.`;

  try {
    const result = await _completeFn([
      { role: 'system' as const, content: 'You extract structured data from text. Return only valid JSON.' },
      { role: 'user' as const, content: prompt },
    ]);

    const parsed = JSON.parse(result.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const item = batch.find(o => o.id === entry.id);
        if (item && entry.cases != null) {
          item.cases = Number(entry.cases) || undefined;
          item.deaths = Number(entry.deaths) || undefined;
          _processedCache.set(item.id, true);
        }
      }
    }
  } catch {
    // LLM extraction failed — no problem, rule-based data still works
  }
}

async function markDuplicateNews(news: NewsItem[]): Promise<void> {
  if (!_completeFn || news.length < 3) return;

  // Only check first 10 titles for dupes
  const titles = news.slice(0, 10).map((n, i) => `[${i}] ${n.title}`).join('\n');
  const prompt = `Which of these headlines describe the SAME event? Return pairs as JSON: [[index1, index2], ...]
If no duplicates, return [].

${titles}

Return ONLY valid JSON array.`;

  try {
    const result = await _completeFn([
      { role: 'system' as const, content: 'You detect duplicate news. Return only valid JSON.' },
      { role: 'user' as const, content: prompt },
    ]);

    const pairs = JSON.parse(result.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
    if (Array.isArray(pairs)) {
      for (const [, j] of pairs) {
        if (typeof j === 'number' && news[j]) {
          // Mark duplicate by prepending [DUP] — consumer can filter
          news[j].category = 'duplicate';
        }
      }
    }
  } catch {
    // Dedup failed — show all items, no harm
  }
}

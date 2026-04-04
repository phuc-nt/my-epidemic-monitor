/**
 * LLM-powered data pipeline — automatic cleanup and transform on each data fetch.
 * Runs in background after outbreak/news data arrives.
 * Falls back to regex/rule-based when LLM unavailable.
 */

import type { DiseaseOutbreakItem, NewsItem } from '@/types';
import type { ChatMessage } from '@/types/llm-types';
import { findDuplicatesByTitle } from '@/services/news-dedup-rules';

// Cache processed results to avoid re-calling LLM for same input
const _processedCache = new Map<string, unknown>();

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

  // Dedup — always runs rule-based tier; LLM tier only when available
  if (news.length > 2) {
    await markDuplicateNews(news);
  }
}

// ---------------------------------------------------------------------------
// Rule-based transforms (always available, fast)
// ---------------------------------------------------------------------------

/**
 * Disease alias lookup — sorted longest-first to avoid partial matches.
 * Includes both English (WHO/CDC) and Vietnamese (MOH-VN) variants.
 */
const DISEASE_ALIASES: [string, string][] = [
  // English — longer/specific aliases first
  ['avian influenza', 'Cúm gia cầm (Avian Influenza)'],
  ['dengue haemorrhagic fever', 'Sốt xuất huyết (Dengue)'],
  ['dengue fever', 'Sốt xuất huyết (Dengue)'],
  ['dengue', 'Sốt xuất huyết (Dengue)'],
  ['hand, foot and mouth', 'Tay chân miệng (HFMD)'],
  ['hfmd', 'Tay chân miệng (HFMD)'],
  ['covid-19', 'COVID-19'],
  ['covid', 'COVID-19'],
  ['coronavirus', 'COVID-19'],
  ['severe acute respiratory syndrome', 'SARS'],
  ['influenza a', 'Cúm A (Influenza A)'],
  ['influenza', 'Cúm (Influenza)'],
  ['measles', 'Sởi (Measles)'],
  ['cholera', 'Tả (Cholera)'],
  ['mpox', 'Đậu mùa khỉ (Mpox)'],
  ['monkeypox', 'Đậu mùa khỉ (Mpox)'],
  ['rabies', 'Dại (Rabies)'],
  ['typhoid', 'Thương hàn (Typhoid)'],
  ['malaria', 'Sốt rét (Malaria)'],
  ['yellow fever', 'Sốt vàng da (Yellow Fever)'],
  ['plague', 'Dịch hạch (Plague)'],
  ['marburg', 'Marburg'],
  ['ebola', 'Ebola'],
  ['lassa fever', 'Sốt Lassa (Lassa Fever)'],
  ['meningococcal', 'Viêm màng não (Meningococcal)'],
  ['diphtheria', 'Bạch hầu (Diphtheria)'],
  ['pertussis', 'Ho gà (Pertussis)'],
  ['polio', 'Bại liệt (Polio)'],
  ['rift valley fever', 'Sốt Rift Valley'],
  ['japanese encephalitis', 'Viêm não Nhật Bản (JE)'],
  ['chikungunya', 'Sốt Chikungunya'],
  ['zika', 'Zika'],
  ['nipah', 'Nipah'],
  ['mers', 'MERS-CoV'],
  ['hepatitis a', 'Viêm gan A (Hepatitis A)'],
  ['hepatitis e', 'Viêm gan E (Hepatitis E)'],
  ['hepatitis b', 'Viêm gan B (Hepatitis B)'],
  ['tuberculosis', 'Lao (Tuberculosis)'],
  ['leprosy', 'Phong (Leprosy)'],
  ['leptospirosis', 'Leptospirosis'],
  ['crimean-congo', 'Sốt xuất huyết Crimean-Congo'],
  ['acute flaccid paralysis', 'Liệt mềm cấp (AFP)'],
  // Vietnamese — MOH-VN/WHO-VN patterns
  ['sốt xuất huyết', 'Sốt xuất huyết (Dengue)'],
  ['tay chân miệng', 'Tay chân miệng (HFMD)'],
  ['cúm gia cầm', 'Cúm gia cầm (Avian Influenza)'],
  ['cúm a', 'Cúm A (Influenza A)'],
  ['cúm mùa', 'Cúm (Influenza)'],
  ['sởi', 'Sởi (Measles)'],
  ['dịch tả', 'Tả (Cholera)'],
  ['bệnh dại', 'Dại (Rabies)'],
  ['sốt rét', 'Sốt rét (Malaria)'],
  ['bạch hầu', 'Bạch hầu (Diphtheria)'],
  ['ho gà', 'Ho gà (Pertussis)'],
  ['thương hàn', 'Thương hàn (Typhoid)'],
  ['viêm não nhật bản', 'Viêm não Nhật Bản (JE)'],
  ['sốt chikungunya', 'Sốt Chikungunya'],
  ['sốt zika', 'Zika'],
  ['đậu mùa khỉ', 'Đậu mùa khỉ (Mpox)'],
  ['viêm gan a', 'Viêm gan A (Hepatitis A)'],
  ['viêm gan e', 'Viêm gan E (Hepatitis E)'],
  ['bệnh lao', 'Lao (Tuberculosis)'],
  ['sốt vàng da', 'Sốt vàng da (Yellow Fever)'],
  ['dịch hạch', 'Dịch hạch (Plague)'],
  ['bệnh ebola', 'Ebola'],
  ['bệnh marburg', 'Marburg'],
  ['bệnh leptospirosis', 'Leptospirosis'],
  ['bại liệt', 'Bại liệt (Polio)'],
];

/** Match disease name against aliases. Longest match first (array order). */
function normalizeDiseaseNameRule(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [alias, normalized] of DISEASE_ALIASES) {
    if (lower.includes(alias)) return normalized;
  }
  return name;
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

/**
 * Enrich outbreaks in batches of 5 via LLM.
 * Extracts: cases, deaths from summary text.
 * Processes ALL items (not just first 5) by chunking.
 */
async function enrichOutbreaksBatch(items: DiseaseOutbreakItem[]): Promise<void> {
  if (!_completeFn) return;

  // Process in chunks of 5 to stay within token limits
  for (let start = 0; start < items.length; start += 5) {
    const batch = items.slice(start, start + 5);
    const prompt = `Extract case counts and deaths from these Vietnamese/English outbreak summaries.
Return a JSON array. Each entry: { "idx": number, "cases": number|null, "deaths": number|null }
If no numbers found, set null.

${batch.map((o, i) => `[${i}] ${o.disease} — ${o.summary.slice(0, 200)}`).join('\n')}

Return ONLY valid JSON array.`;

    try {
      const result = await _completeFn([
        { role: 'system' as const, content: 'Extract numbers from text. Return only valid JSON array. No explanation.' },
        { role: 'user' as const, content: prompt },
      ]);

      const json = result.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const idx = typeof entry.idx === 'number' ? entry.idx : -1;
          if (idx >= 0 && idx < batch.length) {
            const item = batch[idx];
            if (entry.cases != null) item.cases = Number(entry.cases) || undefined;
            if (entry.deaths != null) item.deaths = Number(entry.deaths) || undefined;
            _processedCache.set(item.id, true);
          }
        }
      }
    } catch {
      // LLM extraction failed for this batch — continue with next
    }
  }
}

async function markDuplicateNews(news: NewsItem[]): Promise<void> {
  const titles = news.map(n => n.title);

  // Tier 1: Rule-based (always runs, fast, no API call)
  // High confidence threshold — mark these immediately as duplicates
  const rulePairs = findDuplicatesByTitle(titles, 0.5);
  for (const [, j] of rulePairs) {
    if (news[j]) news[j].category = 'duplicate';
  }

  // Tier 2: LLM for ambiguous pairs (0.25–0.5 similarity range)
  // Only sends pairs that rule-based didn't already resolve
  if (!_completeFn) return;

  const maybePairs = findDuplicatesByTitle(titles, 0.25).filter(
    ([a, b]) => news[a]?.category !== 'duplicate' && news[b]?.category !== 'duplicate',
  );

  if (maybePairs.length === 0) return;

  const ambiguousText = maybePairs
    .map(([a, b]) => `A: ${news[a].title}\nB: ${news[b].title}`)
    .join('\n---\n');

  const prompt = `For each pair below, answer YES if both headlines describe the SAME event, NO if different.
Return a JSON array of booleans, one per pair.

${ambiguousText}

Return ONLY a JSON array like [true, false, ...].`;

  try {
    const result = await _completeFn([
      { role: 'system' as const, content: 'You detect duplicate news headlines. Return only valid JSON array of booleans.' },
      { role: 'user' as const, content: prompt },
    ]);

    const json = result.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const verdicts = JSON.parse(json);

    if (Array.isArray(verdicts)) {
      for (let k = 0; k < maybePairs.length; k++) {
        if (verdicts[k] === true) {
          const [, j] = maybePairs[k];
          if (news[j]) news[j].category = 'duplicate';
        }
      }
    }
  } catch {
    // LLM unavailable or parse error — rule-based results are sufficient
  }
}

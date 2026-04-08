/**
 * LLM-powered data pipeline — automatic cleanup and transform on each data fetch.
 * Runs in background after outbreak/news data arrives.
 * Falls back to regex/rule-based when LLM unavailable.
 */

import type { DiseaseOutbreakItem, NewsItem } from '@/types';
import type { ChatMessage } from '@/types/llm-types';
import { findDuplicatesByTitle, titleSimilarity } from '@/services/news-dedup-rules';
import { extractEntitiesRule } from '@/services/llm-entity-extraction-service';
import { apiFetch } from '@/services/api-client';

// Cache processed results to avoid redundant article fetches per session
const _processedCache = new Map<string, unknown>();

/**
 * Kept as a no-op for backwards compatibility with app-init.
 * LLM enrichment was removed because it was consuming the user's daily
 * chat quota on every page load. All processing is now rule-based.
 */
export function setLLMComplete(_fn: ((msgs: ChatMessage[]) => Promise<string>) | null): void {
  // intentional no-op
}

// ---------------------------------------------------------------------------
// Public API — called after each data fetch
// ---------------------------------------------------------------------------

/** Clean, deduplicate, and enrich outbreak data. Modifies array in-place. */
export async function processOutbreaks(outbreaks: DiseaseOutbreakItem[]): Promise<void> {
  for (const o of outbreaks) {
    o.disease = normalizeDiseaseNameRule(o.disease);
    o.summary = cleanText(o.summary);
  }

  // Dedup outbreaks by title similarity (same event from different sources)
  deduplicateOutbreaks(outbreaks);

  // Rule-based enrichment only.
  // LLM enrichment was disabled because it called /api/chat for every page
  // load (~20 requests), exhausting the user's daily chat quota (10/day).
  const needsEnrich = outbreaks.filter(o => !o.cases && !_processedCache.has(o.id));
  if (needsEnrich.length > 0) {
    await enrichOutbreaksBatch(needsEnrich);
  }
}

/**
 * Mark duplicate outbreaks from different sources about the same event.
 * Uses Jaccard title similarity + same disease as heuristic.
 * Keeps the first occurrence (earlier in array), marks later as duplicate via alertLevel.
 */
function deduplicateOutbreaks(outbreaks: DiseaseOutbreakItem[]): void {
  const titles = outbreaks.map(o => o.title);
  const removed = new Set<number>();

  for (let i = 0; i < outbreaks.length - 1; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < outbreaks.length; j++) {
      if (removed.has(j)) continue;
      // Only compare items with same normalized disease
      if (outbreaks[i].disease !== outbreaks[j].disease) continue;
      const sim = titleSimilarity(titles[i], titles[j]);
      if (sim >= 0.4) {
        removed.add(j); // Mark later one for removal
      }
    }
  }

  // Remove duplicates from array (reverse order to preserve indices)
  const indices = Array.from(removed).sort((a, b) => b - a);
  for (const idx of indices) {
    outbreaks.splice(idx, 1);
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
 * Enrich outbreaks: fetch full article body → extract entities (ward-level location, cases, deaths).
 * Uses LLM when available, falls back to rule-based extraction.
 * Processes top 20 items with real URLs to avoid excessive API calls.
 */
async function enrichOutbreaksBatch(items: DiseaseOutbreakItem[]): Promise<void> {
  // Only process items with real article URLs (not generic/empty)
  const enrichable = items
    .filter(o => o.url && o.url.length > 30 && !_processedCache.has(o.id))
    .slice(0, 20); // Limit to top 20 to manage API calls

  for (const item of enrichable) {
    try {
      // Fetch full article body via proxy
      const article = await apiFetch<{ body: string }>(`/api/health/v1/article?url=${encodeURIComponent(item.url)}`);

      if (!article.body || article.body.length < 50) {
        _processedCache.set(item.id, true);
        continue;
      }

      // Extract entities from full article text — rule-based only
      // (LLM enrichment disabled: was consuming chat daily limit on every page load)
      const fullText = `${item.title} ${item.summary} ${article.body}`;
      const entities = extractEntitiesRule(fullText);

      // Apply extracted data (only override if more specific)
      if (entities.cases != null && !item.cases) item.cases = entities.cases;
      if (entities.deaths != null && !item.deaths) item.deaths = entities.deaths;

      // Upgrade location precision: ward > district > province
      if (entities.location.ward && !item.district) {
        item.district = `${entities.location.ward}, ${entities.location.district}`;
      }
      if (entities.location.district && !item.district) {
        item.district = entities.location.district;
      }
      if (entities.location.province && !item.province) {
        item.province = entities.location.province;
      }
      // Use more precise coordinates if available
      if (entities.location.lat && entities.location.lng) {
        item.lat = entities.location.lat;
        item.lng = entities.location.lng;
      }

      _processedCache.set(item.id, true);
    } catch {
      // Article fetch or extraction failed — skip, don't block pipeline
      _processedCache.set(item.id, true);
    }
  }
}

/**
 * Rule-based news deduplication only.
 * LLM tier was removed because every page load was consuming the user's
 * daily chat quota (10 msg/day) — completely unrelated to actual chat usage.
 */
async function markDuplicateNews(news: NewsItem[]): Promise<void> {
  const titles = news.map(n => n.title);
  const rulePairs = findDuplicatesByTitle(titles, 0.5);
  for (const [, j] of rulePairs) {
    if (news[j]) news[j].category = 'duplicate';
  }
}

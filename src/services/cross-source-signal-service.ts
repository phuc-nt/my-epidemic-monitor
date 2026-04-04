/**
 * Cross-Source Signal Detection Service.
 * Detects when multiple independent sources report the same disease+location,
 * using both outbreak data and news items. Groups by canonical disease + location,
 * aggregates distinct sources, and assigns confidence based on source count.
 */
import type { DiseaseOutbreakItem, NewsItem } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossSourceSignal {
  id: string;
  disease: string;
  location: string;           // province or country
  sources: string[];          // e.g. ['VnExpress', 'VietnamNet', 'WHO-DON']
  sourceCount: number;
  confidence: 'high' | 'medium' | 'low'; // 3+ = high, 2 = medium, 1 = low
  latestMention: number;      // timestamp (ms)
  summary: string;
}

// ---------------------------------------------------------------------------
// Disease alias lookup
// ---------------------------------------------------------------------------

const DISEASE_ALIASES: Record<string, string[]> = {
  dengue:      ['dengue', 'sxh', 'sốt xuất huyết', 'deng'],
  hfmd:        ['hand foot mouth', 'hfmd', 'tay chân miệng', 'tcm'],
  measles:     ['measles', 'sởi'],
  covid:       ['covid', 'sars-cov', 'coronavirus'],
  influenza:   ['influenza', 'flu', 'cúm'],
  cholera:     ['cholera', 'tả', 'dịch tả'],
  rabies:      ['rabies', 'dại', 'bệnh dại'],
  tuberculosis:['tuberculosis', 'lao', 'bệnh lao', 'tb'],
  hepatitis:   ['hepatitis', 'viêm gan'],
  chickenpox:  ['chickenpox', 'varicella', 'thủy đậu'],
  diphtheria:  ['diphtheria', 'bạch hầu'],
  pertussis:   ['pertussis', 'ho gà', 'whooping'],
  encephalitis:['encephalitis', 'viêm não'],
  mpox:        ['mpox', 'monkeypox', 'đậu mùa khỉ'],
  ebola:       ['ebola'],
  marburg:     ['marburg'],
  nipah:       ['nipah'],
  malaria:     ['malaria', 'sốt rét'],
};

function canonicalize(disease: string): string {
  const lower = disease.toLowerCase();
  for (const [key, aliases] of Object.entries(DISEASE_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return key;
  }
  return lower.split(/\s+/)[0] ?? lower;
}

function textMatchesDisease(text: string, canonicalKey: string): boolean {
  const aliases = DISEASE_ALIASES[canonicalKey] ?? [canonicalKey];
  const lower = text.toLowerCase();
  return aliases.some(a => lower.includes(a));
}

// ---------------------------------------------------------------------------
// Location matching — normalize diacritics for fuzzy province matching
// ---------------------------------------------------------------------------

/** Remove Vietnamese diacritics for fuzzy matching. */
function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/** Check if news text mentions a location (province or country). */
function textMatchesLocation(text: string, location: string): boolean {
  const normText = removeDiacritics(text);
  const normLoc = removeDiacritics(location);
  // Direct substring match
  if (normText.includes(normLoc)) return true;
  // Try each word of location (e.g. "Ho Chi Minh" → "chi minh" match in "tp. ho chi minh")
  const words = normLoc.split(/\s+/).filter(w => w.length > 3);
  return words.length > 0 && words.every(w => normText.includes(w));
}

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

export function detectCrossSourceSignals(
  outbreaks: DiseaseOutbreakItem[],
  news: NewsItem[],
): CrossSourceSignal[] {
  const signalMap = new Map<string, {
    disease: string;
    location: string;
    canonicalKey: string;
    sources: Set<string>;
    latestMention: number;
  }>();

  // --- Step 1: seed from outbreaks (each outbreak has a real source now) ---
  for (const ob of outbreaks) {
    const canonicalKey = canonicalize(ob.disease);
    const location = ob.province ?? ob.country;
    const source = ob.source ?? 'Unknown';
    const mapKey = `${canonicalKey}|${location}`;

    if (!signalMap.has(mapKey)) {
      signalMap.set(mapKey, {
        disease: ob.disease,
        location,
        canonicalKey,
        sources: new Set([source]),
        latestMention: ob.publishedAt,
      });
    } else {
      const entry = signalMap.get(mapKey)!;
      entry.sources.add(source);
      if (ob.publishedAt > entry.latestMention) entry.latestMention = ob.publishedAt;
    }
  }

  // --- Step 2: enrich from news (match BOTH disease AND location) ---
  for (const item of news) {
    const text = `${item.title} ${item.summary ?? ''}`;
    for (const [, entry] of signalMap) {
      if (textMatchesDisease(text, entry.canonicalKey) && textMatchesLocation(text, entry.location)) {
        const source = item.source || 'Unknown';
        entry.sources.add(source);
        if (item.publishedAt > entry.latestMention) entry.latestMention = item.publishedAt;
      }
    }
  }

  // --- Step 3: build signals (only include entries with 2+ sources) ---
  const signals: CrossSourceSignal[] = [];

  for (const [mapKey, entry] of signalMap) {
    const sourcesArr = Array.from(entry.sources);
    const sourceCount = sourcesArr.length;
    if (sourceCount < 2) continue; // Skip single-source entries

    const confidence: CrossSourceSignal['confidence'] =
      sourceCount >= 3 ? 'high' : 'medium';

    const displayDisease = entry.disease.split('(')[0]?.trim() ?? entry.disease;
    signals.push({
      id: mapKey,
      disease: entry.disease,
      location: entry.location,
      sources: sourcesArr,
      sourceCount,
      confidence,
      latestMention: entry.latestMention,
      summary: `${displayDisease} in ${entry.location} reported by ${sourcesArr.join(', ')}`,
    });
  }

  // Sort by confidence desc, then sourceCount desc
  const CONFIDENCE_ORDER: Record<CrossSourceSignal['confidence'], number> = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => {
    const cDiff = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
    return cDiff !== 0 ? cDiff : b.sourceCount - a.sourceCount;
  });

  return signals;
}

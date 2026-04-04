/**
 * Cross-Source Signal Detection Service.
 * Detects when outbreak data and news mention the same disease+location,
 * indicating multiple independent sources are reporting the same outbreak.
 */
import type { DiseaseOutbreakItem, NewsItem } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrossSourceSignal {
  id: string;
  disease: string;
  location: string;           // province or country
  sources: string[];          // e.g. ['WHO DON', 'MOH-VN', 'CDC']
  sourceCount: number;
  confidence: 'high' | 'medium' | 'low'; // 3+ = high, 2 = medium, 1 = low
  latestMention: number;      // timestamp (ms)
  summary: string;            // e.g. "Dengue in TPHCM reported by WHO, MOH-VN, CDC"
}

// ---------------------------------------------------------------------------
// Disease alias lookup — maps canonical disease terms to search keywords
// ---------------------------------------------------------------------------

/** Canonical disease name → list of alternative keywords to match in news titles. */
const DISEASE_ALIASES: Record<string, string[]> = {
  dengue:    ['dengue', 'sxh', 'sốt xuất huyết', 'deng'],
  hfmd:      ['hand foot mouth', 'hfmd', 'tay chân miệng', 'tcm'],
  measles:   ['measles', 'sởi'],
  covid:     ['covid', 'sars-cov', 'coronavirus'],
  influenza: ['influenza', 'flu', 'cúm'],
};

/** Return the canonical disease key for an outbreak disease string. */
function canonicalize(disease: string): string {
  const lower = disease.toLowerCase();
  for (const [key, aliases] of Object.entries(DISEASE_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return key;
  }
  // Fallback: first word lowercase
  return lower.split(/\s+/)[0] ?? lower;
}

/** Return true if the news title contains any alias for the given canonical key. */
function newsMatchesDisease(title: string, canonicalKey: string): boolean {
  const aliases = DISEASE_ALIASES[canonicalKey] ?? [canonicalKey];
  const lower = title.toLowerCase();
  return aliases.some(a => lower.includes(a));
}

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

/** Fixed source label for WHO Disease Outbreak News (DON) entries. */
const OUTBREAK_SOURCE = 'WHO DON';

/**
 * Detect cross-source signals by matching outbreak records with news items.
 * Groups by canonical disease + location, aggregates distinct sources,
 * and assigns confidence based on source count.
 *
 * @param outbreaks - Current outbreak dataset
 * @param news      - Current news feed
 * @returns Array of signals sorted by confidence desc, then sourceCount desc
 */
export function detectCrossSourceSignals(
  outbreaks: DiseaseOutbreakItem[],
  news: NewsItem[],
): CrossSourceSignal[] {
  // Map: "<canonicalDisease>|<location>" → accumulated signal data
  const signalMap = new Map<string, {
    disease: string;
    location: string;
    canonicalKey: string;
    sources: Set<string>;
    latestMention: number;
  }>();

  // --- Step 1: seed from outbreaks ---
  for (const ob of outbreaks) {
    const canonicalKey = canonicalize(ob.disease);
    const location = ob.province ?? ob.country;
    const mapKey = `${canonicalKey}|${location}`;

    if (!signalMap.has(mapKey)) {
      signalMap.set(mapKey, {
        disease: ob.disease,
        location,
        canonicalKey,
        sources: new Set([OUTBREAK_SOURCE]),
        latestMention: ob.publishedAt,
      });
    } else {
      const entry = signalMap.get(mapKey)!;
      entry.sources.add(OUTBREAK_SOURCE);
      if (ob.publishedAt > entry.latestMention) entry.latestMention = ob.publishedAt;
    }
  }

  // --- Step 2: enrich from news ---
  for (const item of news) {
    for (const [mapKey, entry] of signalMap) {
      if (newsMatchesDisease(item.title, entry.canonicalKey)) {
        const source = item.source || 'Unknown';
        // Avoid double-counting outbreak source label
        if (source !== OUTBREAK_SOURCE) entry.sources.add(source);
        if (item.publishedAt > entry.latestMention) entry.latestMention = item.publishedAt;
      }
    }
  }

  // --- Step 3: build CrossSourceSignal objects ---
  const signals: CrossSourceSignal[] = [];

  for (const [mapKey, entry] of signalMap) {
    const sourcesArr = Array.from(entry.sources);
    const sourceCount = sourcesArr.length;
    const confidence: CrossSourceSignal['confidence'] =
      sourceCount >= 3 ? 'high' : sourceCount === 2 ? 'medium' : 'low';

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

  // --- Step 4: sort by confidence desc, then sourceCount desc ---
  const CONFIDENCE_ORDER: Record<CrossSourceSignal['confidence'], number> = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => {
    const cDiff = CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
    return cDiff !== 0 ? cDiff : b.sourceCount - a.sourceCount;
  });

  return signals;
}

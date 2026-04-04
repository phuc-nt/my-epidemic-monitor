/**
 * LLM-powered entity extraction from article full text.
 * Extracts: disease, location (ward/district/province), case counts, deaths, dates.
 * Uses minimax m2.7 via the active LLM provider.
 */

import type { ChatMessage } from '@/types/llm-types';
import { findWardInText, type WardEntry } from '@/data/vietnam-wards-database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedEntity {
  disease: string | null;
  location: {
    ward: string | null;
    district: string | null;
    province: string | null;
    lat: number | null;
    lng: number | null;
  };
  cases: number | null;
  deaths: number | null;
  dateReported: string | null;   // ISO date string
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  confidence: number;            // 0-1
}

// ---------------------------------------------------------------------------
// Rule-based pre-extraction (fast, always available)
// ---------------------------------------------------------------------------

/** Extract numbers that look like case counts from text */
function extractCaseNumbers(text: string): { cases: number | null; deaths: number | null } {
  let cases: number | null = null;
  let deaths: number | null = null;

  // Vietnamese patterns: "X ca mắc", "X ca nhiễm", "ghi nhận X ca"
  const casePatterns = [
    /(\d[\d.,]*)\s*ca\s*(?:mắc|nhiễm|bệnh|dương tính|nghi)/i,
    /ghi nhận\s*(\d[\d.,]*)\s*ca/i,
    /phát hiện\s*(\d[\d.,]*)\s*ca/i,
    /tổng\s*(?:cộng|số)\s*(\d[\d.,]*)\s*ca/i,
    /(\d[\d.,]*)\s*(?:cases?|infections?|confirmed)/i,
  ];

  for (const p of casePatterns) {
    const m = text.match(p);
    if (m) { cases = parseVietnameseNumber(m[1]); break; }
  }

  // Death patterns: "X ca tử vong", "X người chết"
  const deathPatterns = [
    /(\d[\d.,]*)\s*(?:ca\s*)?tử vong/i,
    /(\d[\d.,]*)\s*(?:người\s*)?chết/i,
    /(\d[\d.,]*)\s*deaths?/i,
  ];

  for (const p of deathPatterns) {
    const m = text.match(p);
    if (m) { deaths = parseVietnameseNumber(m[1]); break; }
  }

  return { cases, deaths };
}

/** Parse Vietnamese number format (e.g., "1.234" → 1234, "2,5" → 2) */
function parseVietnameseNumber(s: string): number {
  // Remove dots (thousand separators in VN), replace comma with dot for decimal
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

/** Extract date mentions from text */
function extractDate(text: string): string | null {
  // Vietnamese date: "ngày X/Y", "X/Y/2026", "ngày X tháng Y"
  const patterns = [
    /ngày\s*(\d{1,2})[/-](\d{1,2})[/-]?(\d{4})?/i,
    /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,
    /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})(?:\s*năm\s*(\d{4}))?/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3] || new Date().getFullYear().toString();
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule-based extraction (no LLM needed)
// ---------------------------------------------------------------------------

/**
 * Fast rule-based entity extraction. Always available.
 * Used as fallback when LLM is unavailable, or as pre-filter before LLM.
 */
export function extractEntitiesRule(text: string): ExtractedEntity {
  const { cases, deaths } = extractCaseNumbers(text);
  const wardMatch = findWardInText(text);
  const dateReported = extractDate(text);

  return {
    disease: null, // Disease already extracted by keyword matching in pipeline
    location: wardMatch ? {
      ward: wardMatch.ward,
      district: wardMatch.district,
      province: wardMatch.province,
      lat: wardMatch.lat,
      lng: wardMatch.lng,
    } : { ward: null, district: null, province: null, lat: null, lng: null },
    cases,
    deaths,
    dateReported,
    severity: deriveSeverity(cases, deaths),
    confidence: wardMatch ? 0.7 : 0.4,
  };
}

function deriveSeverity(cases: number | null, deaths: number | null): ExtractedEntity['severity'] {
  if (deaths && deaths > 0) return 'critical';
  if (cases && cases > 1000) return 'high';
  if (cases && cases > 100) return 'medium';
  if (cases && cases > 0) return 'low';
  return null;
}

// ---------------------------------------------------------------------------
// LLM-powered extraction (more accurate, needs active provider)
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `You extract epidemic data from Vietnamese/English news articles.
Return ONLY valid JSON with these fields:
{
  "cases": number or null,
  "deaths": number or null,
  "ward": "ward name" or null,
  "district": "district name" or null,
  "province": "province name" or null,
  "dateReported": "YYYY-MM-DD" or null,
  "severity": "critical"|"high"|"medium"|"low" or null
}
Extract the MOST SPECIFIC location mentioned. Prefer ward > district > province.
For numbers, extract the most relevant case count (not cumulative if possible).`;

/**
 * LLM-powered entity extraction. More accurate than rule-based.
 * Falls back to rule-based if LLM unavailable or fails.
 */
export async function extractEntitiesLLM(
  text: string,
  completeFn: (msgs: ChatMessage[]) => Promise<string>,
): Promise<ExtractedEntity> {
  // Always run rule-based first as baseline
  const ruleResult = extractEntitiesRule(text);

  try {
    const truncated = text.slice(0, 3000); // Limit context for LLM
    const result = await completeFn([
      { role: 'system' as const, content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: `Extract epidemic data:\n\n${truncated}` },
    ]);

    const json = result.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(json);

    // Merge LLM results with rule-based (LLM takes priority where non-null)
    const wardMatch = parsed.ward ? findWardInText(`${parsed.ward} ${parsed.district ?? ''} ${parsed.province ?? ''}`) : null;

    return {
      disease: ruleResult.disease,
      location: wardMatch ? {
        ward: wardMatch.ward,
        district: wardMatch.district,
        province: wardMatch.province,
        lat: wardMatch.lat,
        lng: wardMatch.lng,
      } : {
        ward: parsed.ward ?? ruleResult.location.ward,
        district: parsed.district ?? ruleResult.location.district,
        province: parsed.province ?? ruleResult.location.province,
        lat: ruleResult.location.lat,
        lng: ruleResult.location.lng,
      },
      cases: parsed.cases ?? ruleResult.cases,
      deaths: parsed.deaths ?? ruleResult.deaths,
      dateReported: parsed.dateReported ?? ruleResult.dateReported,
      severity: parsed.severity ?? ruleResult.severity,
      confidence: wardMatch ? 0.9 : 0.75,
    };
  } catch {
    // LLM failed — return rule-based results
    return ruleResult;
  }
}

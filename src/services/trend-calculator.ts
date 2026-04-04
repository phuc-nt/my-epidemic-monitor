/**
 * Computes time-series trend data from IndexedDB outbreak snapshots.
 * All functions are pure — no side effects, no I/O.
 */

import type { SnapshotRecord } from '@/services/snapshot-store';

// --- Types ---

export interface TrendPoint {
  timestamp: number;
  value: number;
}

export interface TrendSummary {
  disease: string;
  points: TrendPoint[];     // time-series case counts per snapshot
  latestValue: number;
  previousValue: number;
  delta: number;            // latestValue - previousValue
  deltaPercent: number;     // ((latest - prev) / prev) * 100
  trend: 'rising' | 'falling' | 'stable';
}

// --- Internal helpers ---

/** Sum cases for a specific disease within a single snapshot. */
function sumCasesForDisease(record: SnapshotRecord, disease: string): number {
  return record.outbreaks
    .filter((o) => o.disease === disease)
    .reduce((sum, o) => sum + o.cases, 0);
}

/** Classify trend direction based on percentage delta. */
function classifyTrend(deltaPercent: number): 'rising' | 'falling' | 'stable' {
  if (deltaPercent > 5) return 'rising';
  if (deltaPercent < -5) return 'falling';
  return 'stable';
}

/** Compute delta percent safely — returns 0 when previous is 0. */
function safeDeltaPercent(latest: number, previous: number): number {
  if (previous === 0) return latest > 0 ? 100 : 0;
  return ((latest - previous) / previous) * 100;
}

// --- Public API ---

/**
 * Compute trend for a specific disease across all provided snapshots.
 * Snapshots should be ordered by timestamp ascending (as returned from IDB).
 */
export function computeDiseaseTrend(
  snapshots: SnapshotRecord[],
  disease: string,
): TrendSummary {
  // Build time-series points — one point per snapshot
  const points: TrendPoint[] = snapshots.map((record) => ({
    timestamp: record.timestamp,
    value: sumCasesForDisease(record, disease),
  }));

  const latestValue = points.length > 0 ? points[points.length - 1].value : 0;
  const previousValue = points.length > 1 ? points[points.length - 2].value : latestValue;
  const delta = latestValue - previousValue;
  const deltaPercent = safeDeltaPercent(latestValue, previousValue);

  return {
    disease,
    points,
    latestValue,
    previousValue,
    // Edge case: single snapshot → no real delta
    delta: snapshots.length <= 1 ? 0 : delta,
    deltaPercent: snapshots.length <= 1 ? 0 : deltaPercent,
    trend: snapshots.length <= 1 ? 'stable' : classifyTrend(deltaPercent),
  };
}

/**
 * Compute aggregate stats delta between the two most recent snapshots.
 * Returns totals delta for cases, deaths, and count of new disease+country pairs.
 */
export function computeStatsDelta(
  snapshots: SnapshotRecord[],
): { totalCasesDelta: number; totalDeathsDelta: number; newOutbreaks: number; trend: string } {
  if (snapshots.length === 0) {
    return { totalCasesDelta: 0, totalDeathsDelta: 0, newOutbreaks: 0, trend: 'stable' };
  }

  const latest = snapshots[snapshots.length - 1];

  if (snapshots.length === 1) {
    // Single snapshot — no comparison baseline, don't show delta
    return {
      totalCasesDelta: 0,
      totalDeathsDelta: 0,
      newOutbreaks: 0,
      trend: 'stable',
    };
  }

  const previous = snapshots[snapshots.length - 2];

  const latestCases = latest.outbreaks.reduce((s, o) => s + o.cases, 0);
  const previousCases = previous.outbreaks.reduce((s, o) => s + o.cases, 0);
  const latestDeaths = latest.outbreaks.reduce((s, o) => s + o.deaths, 0);
  const previousDeaths = previous.outbreaks.reduce((s, o) => s + o.deaths, 0);

  // Count outbreaks (disease+country) present in latest but not previous
  const previousKeys = new Set(
    previous.outbreaks.map((o) => `${o.disease}|${o.countryCode}`),
  );
  const newOutbreaks = latest.outbreaks.filter(
    (o) => !previousKeys.has(`${o.disease}|${o.countryCode}`),
  ).length;

  const totalCasesDelta = latestCases - previousCases;
  const casesDeltaPercent = safeDeltaPercent(latestCases, previousCases);

  return {
    totalCasesDelta,
    totalDeathsDelta: latestDeaths - previousDeaths,
    newOutbreaks,
    trend: classifyTrend(casesDeltaPercent),
  };
}

/**
 * Compute trend summaries for every disease found across all snapshots.
 * Returns results sorted by delta descending (fastest-growing first).
 */
export function computeAllTrends(snapshots: SnapshotRecord[]): TrendSummary[] {
  // Collect distinct disease names across all snapshots
  const diseases = new Set<string>();
  for (const record of snapshots) {
    for (const o of record.outbreaks) {
      diseases.add(o.disease);
    }
  }

  const summaries = Array.from(diseases).map((disease) =>
    computeDiseaseTrend(snapshots, disease),
  );

  // Sort by delta descending — fastest-growing diseases appear first
  return summaries.sort((a, b) => b.delta - a.delta);
}

// ---------------------------------------------------------------------------
// Alert escalation detection
// ---------------------------------------------------------------------------

export interface EscalationInfo {
  outbreakId: string;
  disease: string;
  country: string;
  previousLevel: string;
  currentLevel: string;
}

/**
 * Detect outbreaks that escalated between the two most recent snapshots.
 * E.g., watch → warning, warning → alert.
 */
export function detectEscalations(snapshots: SnapshotRecord[]): EscalationInfo[] {
  if (snapshots.length < 2) return [];

  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];

  const LEVEL_ORDER: Record<string, number> = { watch: 0, warning: 1, alert: 2 };

  // Build lookup: disease+country → alertLevel from previous snapshot
  const prevLevels = new Map<string, string>();
  for (const o of prev.outbreaks) {
    const key = `${o.disease}|${o.countryCode}`;
    const existing = prevLevels.get(key);
    if (!existing || (LEVEL_ORDER[o.alertLevel] ?? 0) > (LEVEL_ORDER[existing] ?? 0)) {
      prevLevels.set(key, o.alertLevel);
    }
  }

  const escalations: EscalationInfo[] = [];
  for (const o of curr.outbreaks) {
    const key = `${o.disease}|${o.countryCode}`;
    const prevLevel = prevLevels.get(key);
    if (prevLevel && (LEVEL_ORDER[o.alertLevel] ?? 0) > (LEVEL_ORDER[prevLevel] ?? 0)) {
      escalations.push({
        outbreakId: key,
        disease: o.disease,
        country: o.countryCode,
        previousLevel: prevLevel,
        currentLevel: o.alertLevel,
      });
    }
  }

  return escalations;
}

// ---------------------------------------------------------------------------
// Early warning: climate HIGH + no active outbreak
// ---------------------------------------------------------------------------

export interface EarlyWarning {
  province: string;
  lat: number;
  lng: number;
  dengueRisk: number;
  hfmdRisk: number;
}

/**
 * Find provinces with HIGH climate risk but NO active outbreak.
 * Requires climate forecasts + current outbreaks.
 */
export function detectEarlyWarnings(
  climateForecasts: { province: string; lat: number; lng: number; dengueRisk: number; hfmdRisk: number }[],
  outbreakProvinces: Set<string>,
): EarlyWarning[] {
  return climateForecasts
    .filter(f => (f.dengueRisk >= 0.6 || f.hfmdRisk >= 0.6) && !outbreakProvinces.has(f.province))
    .map(f => ({ province: f.province, lat: f.lat, lng: f.lng, dengueRisk: f.dengueRisk, hfmdRisk: f.hfmdRisk }));
}

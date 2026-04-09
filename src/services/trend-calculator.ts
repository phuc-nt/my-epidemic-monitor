/**
 * Signal-detection helpers over IndexedDB outbreak snapshots:
 *   - detectEscalations: outbreaks whose alert level rose since the last snapshot
 *   - detectEarlyWarnings: provinces with climate risk but no active outbreak yet
 * All functions are pure — no side effects, no I/O.
 */

import type { SnapshotRecord } from '@/services/snapshot-store';

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

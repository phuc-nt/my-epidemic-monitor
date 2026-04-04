/**
 * Case report service — stores submitted case reports in localStorage
 * and exposes helpers for querying and sync-state tracking.
 */

export interface CaseReport {
  id: string;
  disease: string;
  province: string;
  district: string;
  severity: 'suspect' | 'confirmed' | 'severe';
  cases: number;
  deaths: number;
  reportedAt: number;
  detectedAt: string; // ISO date string
  notes: string;
  synced: boolean;
}

const STORAGE_KEY = 'epidemic-monitor-case-reports';
const MAX_STORED = 100;

/**
 * Persist a new report. Assigns id, reportedAt, synced=false automatically.
 * Returns the fully populated report.
 */
export function submitReport(
  report: Omit<CaseReport, 'id' | 'reportedAt' | 'synced'>,
): CaseReport {
  const full: CaseReport = {
    ...report,
    id: crypto.randomUUID(),
    reportedAt: Date.now(),
    synced: false,
  };
  const existing = getReports();
  existing.unshift(full);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_STORED)));
  } catch (err) {
    console.error('[case-report-service] Failed to persist report:', err);
  }
  return full;
}

/** Retrieve all stored reports, newest first. Returns [] on parse error. */
export function getReports(): CaseReport[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CaseReport[];
  } catch {
    return [];
  }
}

/** Number of reports that have not been synced to a remote server. */
export function getUnsyncedCount(): number {
  return getReports().filter((r) => !r.synced).length;
}

/** Mark a report as synced by id. No-op if id not found. */
export function markSynced(id: string): void {
  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reports[idx]!.synced = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error('[case-report-service] Failed to mark report synced:', err);
  }
}

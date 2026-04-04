/**
 * IndexedDB-based persistent storage for outbreak snapshots.
 * Enables time-series trend tracking across browser sessions.
 * Falls back silently if IndexedDB is unavailable (e.g. private browsing).
 */

import type { DiseaseOutbreakItem } from '@/types';

// --- Types ---

interface OutbreakSnapshot {
  disease: string;
  countryCode: string;
  alertLevel: string;
  cases: number;
  deaths: number;
}

export interface SnapshotRecord {
  id?: number;       // auto-increment IDB key
  timestamp: number; // Date.now()
  outbreaks: OutbreakSnapshot[];
}

// --- Constants ---

const DB_NAME = 'epidemic-monitor-snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const DEFAULT_KEEP_DAYS = 30;

// --- Module-level DB handle ---

let db: IDBDatabase | null = null;

// --- Internal helpers ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        // Index on timestamp enables efficient range queries
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function getDB(): IDBDatabase {
  if (!db) throw new Error('SnapshotDB not initialized. Call initSnapshotDB() first.');
  return db;
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Public API ---

/** Open/create the IndexedDB database. Call once on app init. */
export async function initSnapshotDB(): Promise<void> {
  try {
    db = await openDB();
  } catch {
    // IndexedDB unavailable (private browsing, quota exceeded, etc.) — degrade silently
    db = null;
  }
}

/**
 * Save current outbreak state as a snapshot.
 * Extracts minimal fields to keep records small.
 * Called after each data fetch.
 */
export async function saveSnapshot(outbreaks: DiseaseOutbreakItem[]): Promise<void> {
  if (!db) return;

  const record: SnapshotRecord = {
    timestamp: Date.now(),
    outbreaks: outbreaks.map((o) => ({
      disease: o.disease,
      countryCode: o.countryCode,
      alertLevel: o.alertLevel,
      cases: o.cases ?? 0,
      deaths: o.deaths ?? 0,
    })),
  };

  try {
    const tx = getDB().transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await idbRequest(store.add(record));
  } catch {
    // Non-fatal — snapshot may fail if storage is full
  }
}

/**
 * Get all snapshots within a time range.
 * @param fromMs Start timestamp (inclusive)
 * @param toMs   End timestamp (inclusive, defaults to now)
 */
export async function getSnapshots(
  fromMs: number,
  toMs?: number,
): Promise<SnapshotRecord[]> {
  if (!db) return [];

  try {
    const upper = toMs ?? Date.now();
    const range = IDBKeyRange.bound(fromMs, upper);
    const tx = getDB().transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('timestamp');
    return await idbRequest<SnapshotRecord[]>(index.getAll(range) as IDBRequest<SnapshotRecord[]>);
  } catch {
    return [];
  }
}

/**
 * Get snapshots for the last N days.
 * Convenience wrapper around getSnapshots.
 */
export async function getRecentSnapshots(days: number): Promise<SnapshotRecord[]> {
  const fromMs = Date.now() - days * 86_400_000;
  return getSnapshots(fromMs);
}

/**
 * Delete snapshots older than keepDays (default: 30).
 * Call periodically to prevent unbounded storage growth.
 */
export async function pruneOldSnapshots(keepDays: number = DEFAULT_KEEP_DAYS): Promise<void> {
  if (!db) return;

  try {
    const cutoff = Date.now() - keepDays * 86_400_000;
    const range = IDBKeyRange.upperBound(cutoff);
    const tx = getDB().transaction(STORE_NAME, 'readwrite');
    const index = tx.objectStore(STORE_NAME).index('timestamp');

    // Collect IDs to delete, then delete by primary key
    const keysRequest = index.getAllKeys(range) as IDBRequest<IDBValidKey[]>;
    const keys = await idbRequest(keysRequest);
    const store = tx.objectStore(STORE_NAME);
    await Promise.all(keys.map((key) => idbRequest(store.delete(key))));
  } catch {
    // Non-fatal — pruning failure does not affect reads
  }
}

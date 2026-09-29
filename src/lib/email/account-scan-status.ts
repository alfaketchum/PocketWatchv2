/**
 * In-memory progress for account-directory Gmail scans, keyed by user. Doubles
 * as the per-user in-flight guard (the app runs as a single Node process, so a
 * module-level map is sufficient; it resets on restart, which only loses history).
 */

export type ScanState = "idle" | "running" | "done" | "error"

export interface ScanStatus {
  state: ScanState
  startedAt: string | null
  finishedAt: string | null
  scanned: number
  imported: number
  updated: number
  skipped: number
  llmCalls: number
  /** True once every connected mailbox has finished its historical backfill. */
  backfillComplete: boolean
  error: string | null
}

const IDLE: ScanStatus = {
  state: "idle",
  startedAt: null,
  finishedAt: null,
  scanned: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  llmCalls: 0,
  backfillComplete: false,
  error: null,
}

const statuses = new Map<string, ScanStatus>()

export function getScanStatus(userId: string): ScanStatus {
  return statuses.get(userId) ?? IDLE
}

export function isScanRunning(userId: string): boolean {
  return getScanStatus(userId).state === "running"
}

export function beginScan(userId: string): void {
  statuses.set(userId, { ...IDLE, state: "running", startedAt: new Date().toISOString() })
}

export function updateScan(userId: string, patch: Partial<ScanStatus>): void {
  statuses.set(userId, { ...getScanStatus(userId), ...patch })
}

type Counter = "scanned" | "imported" | "updated" | "skipped" | "llmCalls"

export function bumpScan(userId: string, counter: Counter, by = 1): void {
  const current = getScanStatus(userId)
  statuses.set(userId, { ...current, [counter]: current[counter] + by })
}

export function finishScan(userId: string, error: string | null): void {
  updateScan(userId, {
    state: error ? "error" : "done",
    finishedAt: new Date().toISOString(),
    error,
  })
}

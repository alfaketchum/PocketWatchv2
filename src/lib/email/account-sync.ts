/**
 * Gmail → account directory sync.
 *
 * Scans every connected Gmail account for account-signal emails, extracts the
 * service + the email it was signed up with (hybrid heuristic/LLM), and upserts
 * one DiscoveredAccount per (service domain, account email). Idempotent and
 * userId-scoped. Paging/backfill per mailbox lives in account-scan-mailbox.ts.
 *
 * Dedupe is per user across all of their mailboxes: a Gmail message id already
 * recorded in any of their DiscoveredAccount.sourceRefs (or seen earlier this
 * run) is skipped. Writes use the GLOBAL encryption key (no per-user session
 * context here) so the background worker and interactive scans can both decrypt.
 */

import { db } from "@/lib/db"
import { resolveProvider } from "@/lib/chat/agent-loop"
import type { AIProviderConfig } from "@/lib/finance/ai-providers"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import { SCAN_MAX_LLM_CALLS_PER_RUN } from "./account-signals"
import { scanMailbox, type ScanRunContext } from "./account-scan-mailbox"
import {
  beginScan,
  finishScan,
  getScanStatus,
  isScanRunning,
  updateScan,
  type ScanStatus,
} from "./account-scan-status"

export class ScanAlreadyRunningError extends Error {
  constructor() {
    super("An account scan is already running — wait for it to finish.")
  }
}

interface SyncOptions {
  /** Stop starting new pages after this many ms (the scheduled worker's budget). */
  timeBudgetMs?: number
}

/** Run a scan to completion and return its final status. */
export async function syncAccountsFromGmail(
  userId: string,
  options: SyncOptions = {},
): Promise<ScanStatus> {
  if (isScanRunning(userId)) throw new ScanAlreadyRunningError()
  beginScan(userId)
  try {
    await runScan(userId, options)
    finishScan(userId, null)
  } catch (err) {
    finishScan(userId, err instanceof Error ? err.message : String(err))
    throw err
  }
  return getScanStatus(userId)
}

/**
 * Start a scan without awaiting it (interactive "Scan Gmail"); progress is read
 * via getScanStatus. Throws ScanAlreadyRunningError if one is in flight.
 */
export function startBackgroundScan(userId: string): void {
  if (isScanRunning(userId)) throw new ScanAlreadyRunningError()
  syncAccountsFromGmail(userId).catch((err) => {
    console.error("[email] background account scan failed:", (err as Error).message)
  })
}

async function runScan(userId: string, options: SyncOptions): Promise<void> {
  const [providerConfig, accounts, known] = await Promise.all([
    loadProviderConfig(userId),
    listGmailAccounts(userId),
    loadKnownState(userId),
  ])

  const runDeadline = options.timeBudgetMs ? Date.now() + options.timeBudgetMs : null
  const ctx: ScanRunContext = {
    userId,
    providerConfig,
    seen: known.seen,
    llmKnown: known.llmKnown,
    llmCallsLeft: SCAN_MAX_LLM_CALLS_PER_RUN,
    deadline: runDeadline,
  }

  let allBackfilled = true
  for (const [i, account] of accounts.entries()) {
    // Split what's left of a time budget evenly over the remaining mailboxes so
    // the first one can't starve the rest; unused time rolls forward.
    if (runDeadline !== null) {
      const share = (runDeadline - Date.now()) / (accounts.length - i)
      ctx.deadline = Date.now() + Math.max(0, share)
    }
    const done = await scanMailbox(ctx, account)
    allBackfilled = allBackfilled && done
  }
  updateScan(userId, { backfillComplete: allBackfilled })
}

/** Resolve the AI provider, or null when none is configured (heuristic-only). */
async function loadProviderConfig(userId: string): Promise<AIProviderConfig | null> {
  try {
    const p = await resolveProvider(userId)
    return { provider: p.type, apiKey: p.apiKey, model: p.model }
  } catch {
    return null
  }
}

async function loadKnownState(userId: string) {
  const rows = await db.discoveredAccount.findMany({
    where: { userId },
    select: { sourceRefs: true, serviceDomain: true, accountEmailHash: true, extractedBy: true },
  })
  const seen = new Set<string>()
  const llmKnown = new Set<string>()
  for (const row of rows) {
    for (const ref of row.sourceRefs) seen.add(ref)
    if (row.extractedBy === "llm") llmKnown.add(`${row.serviceDomain}|${row.accountEmailHash}`)
  }
  return { seen, llmKnown }
}

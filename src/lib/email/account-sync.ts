/**
 * Gmail → account directory sync.
 *
 * Scans every connected Gmail account for account-signal emails, extracts the
 * service + the email it was signed up with (hybrid heuristic/LLM), and upserts
 * one DiscoveredAccount per (service domain, account email). Idempotent and
 * userId-scoped. Direct analogue of src/lib/trips/email-trip-parser.ts.
 *
 * Dedupe is GLOBAL across accounts: a Gmail message id already recorded in ANY
 * DiscoveredAccount.sourceRefs (or seen earlier this run) is skipped. Writes use
 * the GLOBAL encryption key (no per-user session context here) so the background
 * worker and interactive scans can both decrypt the rows.
 */

import { db } from "@/lib/db"
import { resolveProvider } from "@/lib/chat/agent-loop"
import type { AIProviderConfig } from "@/lib/finance/ai-providers"
import {
  listGmailAccounts,
  searchMessages,
  getMessage,
  type GmailAccount,
  type GmailMessage,
} from "@/lib/integrations/gmail-client"
import { hashAccountEmail } from "./account-hash"
import { ACCOUNT_SIGNAL_QUERY } from "./account-signals"
import { extractAccount, type ExtractedAccount } from "./account-extractor"

const MAX_MESSAGES = 50

export interface AccountSyncResult {
  scanned: number
  imported: number
  updated: number
  skipped: number
  accounts: { email: string | null; imported: number; updated: number }[]
}

// Per-user in-flight guard: the dedupe set is snapshotted at the start, so two
// overlapping syncs could each import the same message. Serialize per user.
const syncingUsers = new Set<string>()

export async function syncAccountsFromGmail(userId: string): Promise<AccountSyncResult> {
  if (syncingUsers.has(userId)) {
    throw new Error("An account scan is already running — wait for it to finish.")
  }
  syncingUsers.add(userId)
  try {
    const providerConfig = await loadProviderConfig(userId)
    const accounts = await listGmailAccounts(userId)
    const seen = await loadProcessedMessageIds(userId)

    let scanned = 0
    let imported = 0
    let updated = 0
    let skipped = 0
    const summaries: AccountSyncResult["accounts"] = []

    for (const account of accounts) {
      const r = await scanAccount(userId, account, providerConfig, seen)
      scanned += r.scanned
      imported += r.imported
      updated += r.updated
      skipped += r.skipped
      summaries.push({ email: account.email, imported: r.imported, updated: r.updated })
    }

    return { scanned, imported, updated, skipped, accounts: summaries }
  } finally {
    syncingUsers.delete(userId)
  }
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

async function loadProcessedMessageIds(userId: string): Promise<Set<string>> {
  const rows = await db.discoveredAccount.findMany({
    where: { userId, sourceRefs: { isEmpty: false } },
    select: { sourceRefs: true },
  })
  const ids = new Set<string>()
  for (const row of rows) {
    for (const ref of row.sourceRefs) ids.add(ref)
  }
  return ids
}

interface AccountScanResult {
  scanned: number
  imported: number
  updated: number
  skipped: number
}

/**
 * Scan ONE account. Mutates the shared `seen` set so a message id handled here
 * dedups against later accounts in the same run.
 */
async function scanAccount(
  userId: string,
  account: GmailAccount,
  providerConfig: AIProviderConfig | null,
  seen: Set<string>,
): Promise<AccountScanResult> {
  const messageIds = await searchMessages(userId, account.service, ACCOUNT_SIGNAL_QUERY, MAX_MESSAGES)
  const mailboxEmail = account.email ?? ""
  let imported = 0
  let updated = 0
  let skipped = 0

  for (const id of messageIds) {
    if (seen.has(id)) {
      skipped++
      continue
    }
    seen.add(id)
    try {
      const outcome = await processMessage(userId, account, id, mailboxEmail, providerConfig)
      if (outcome === "imported") imported++
      else if (outcome === "updated") updated++
      else skipped++
    } catch (err) {
      console.warn("[email] account scan failed for message:", (err as Error).message)
      skipped++
    }
  }

  return { scanned: messageIds.length, imported, updated, skipped }
}

async function processMessage(
  userId: string,
  account: GmailAccount,
  id: string,
  mailboxEmail: string,
  providerConfig: AIProviderConfig | null,
): Promise<"imported" | "updated" | "skipped"> {
  const msg = await getMessage(userId, account.service, id)
  if (!msg || !msg.bodyText.trim()) return "skipped"

  const extracted = await extractAccount(msg, mailboxEmail, providerConfig)
  if (!extracted || !extracted.accountEmail || !extracted.serviceDomain) return "skipped"

  return upsertDiscoveredAccount(userId, account, msg, extracted)
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function upsertDiscoveredAccount(
  userId: string,
  account: GmailAccount,
  msg: GmailMessage,
  extracted: ExtractedAccount,
): Promise<"imported" | "updated"> {
  const accountEmailHash = hashAccountEmail(extracted.accountEmail)
  const seenAt = parseDate(msg.date)
  const evidence = {
    subject: msg.subject.slice(0, 200),
    from: msg.from.slice(0, 200),
    snippet: msg.bodyText.slice(0, 200),
  }

  const existing = await db.discoveredAccount.findUnique({
    where: {
      userId_serviceDomain_accountEmailHash: {
        userId,
        serviceDomain: extracted.serviceDomain,
        accountEmailHash,
      },
    },
    select: {
      id: true,
      signalTypes: true,
      sourceRefs: true,
      lastSeenAt: true,
      confidence: true,
      userEdited: true,
      category: true,
    },
  })

  if (!existing) {
    await db.discoveredAccount.create({
      data: {
        userId,
        serviceName: extracted.serviceName,
        serviceDomain: extracted.serviceDomain,
        category: extracted.category,
        accountEmail: extracted.accountEmail,
        accountEmailHash,
        sourceService: account.service,
        signalTypes: [extracted.signalType],
        evidence,
        sourceRefs: [msg.id],
        confidence: extracted.confidence,
        extractedBy: extracted.extractedBy,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      },
    })
    return "imported"
  }

  const signalTypes = existing.signalTypes.includes(extracted.signalType)
    ? existing.signalTypes
    : [...existing.signalTypes, extracted.signalType]
  const sourceRefs = existing.sourceRefs.includes(msg.id)
    ? existing.sourceRefs
    : [...existing.sourceRefs, msg.id]
  const lastSeenAt =
    seenAt && (!existing.lastSeenAt || seenAt > existing.lastSeenAt)
      ? seenAt
      : existing.lastSeenAt

  await db.discoveredAccount.update({
    where: { id: existing.id },
    data: {
      signalTypes,
      sourceRefs,
      lastSeenAt,
      confidence: Math.max(existing.confidence, extracted.confidence),
      // Never clobber user-curated fields.
      ...(existing.userEdited
        ? {}
        : {
            serviceName: extracted.serviceName,
            category: extracted.category ?? existing.category,
          }),
    },
  })
  return "updated"
}

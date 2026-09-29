/**
 * Scan ONE connected mailbox for account signals, page by page.
 *
 * Each run spends up to SCAN_MAX_MESSAGES_PER_RUN messages on:
 *   1. an incremental pass over mail newer than the last run's watermark, then
 *   2. the historical backfill, resumed from the saved Gmail pageToken.
 * Progress is persisted in GmailScanState after every page, so an interrupted
 * run (deadline, restart) resumes where it stopped and no message is re-read.
 */

import { db } from "@/lib/db"
import { forEachConcurrent } from "@/lib/async-pool"
import type { AIProviderConfig } from "@/lib/finance/ai-providers"
import {
  getMessage,
  searchMessagesPage,
  type GmailAccount,
} from "@/lib/integrations/gmail-client"
import { hashAccountEmail } from "./account-hash"
import {
  ACCOUNT_SIGNAL_QUERY,
  SCAN_CONCURRENCY,
  SCAN_MAX_MESSAGES_PER_RUN,
  SCAN_PAGE_SIZE,
  SCAN_PAGE_SIZE_TIMED,
  SCAN_WINDOW,
  classifySignal,
  isRelayDomain,
} from "./account-signals"
import { extractAccount } from "./account-extractor"
import { upsertDiscoveredAccount } from "./account-upsert"
import { bumpScan } from "./account-scan-status"

// Overlap the incremental window so mail that arrived mid-run isn't missed;
// already-imported ids are skipped via the `seen` set.
const INCREMENTAL_OVERLAP_MS = 60 * 60 * 1000

/** Shared state for one user's scan run across all of their mailboxes. */
export interface ScanRunContext {
  userId: string
  providerConfig: AIProviderConfig | null
  /** Gmail ids already recorded in DiscoveredAccount.sourceRefs (or seen this run). */
  seen: Set<string>
  /** `${domain}|${emailHash}` pairs that already have an LLM-extracted row. */
  llmKnown: Set<string>
  llmCallsLeft: number
  /** Epoch ms after which no new page is started (null = no limit). */
  deadline: number | null
}

interface PageBudget {
  pages: number
  pageSize: number
}

function pastDeadline(ctx: ScanRunContext): boolean {
  return ctx.deadline !== null && Date.now() > ctx.deadline
}

/** Scan one mailbox. Returns whether its historical backfill is complete. */
export async function scanMailbox(ctx: ScanRunContext, account: GmailAccount): Promise<boolean> {
  const state = await db.gmailScanState.upsert({
    where: { userId_service: { userId: ctx.userId, service: account.service } },
    create: { userId: ctx.userId, service: account.service },
    update: {},
  })
  const runStartedAt = new Date()
  const pageSize = ctx.deadline === null ? SCAN_PAGE_SIZE : SCAN_PAGE_SIZE_TIMED
  const budget: PageBudget = { pages: Math.ceil(SCAN_MAX_MESSAGES_PER_RUN / pageSize), pageSize }

  let watermark = state.lastIncrementalAt
  if (watermark) {
    const after = Math.floor((watermark.getTime() - INCREMENTAL_OVERLAP_MS) / 1000)
    const finished = await runIncremental(ctx, account, `after:${after} ${ACCOUNT_SIGNAL_QUERY}`, budget)
    if (finished) watermark = runStartedAt
  } else {
    // First run: the backfill starts at the newest message, so it covers "now".
    watermark = runStartedAt
  }

  const backfillDone = state.backfillDone || (await runBackfill(ctx, account, state.backfillPageToken, budget))

  await db.gmailScanState.update({
    where: { id: state.id },
    data: { lastIncrementalAt: watermark },
  })
  return backfillDone
}

/** Walk every page of the incremental query. Returns true if it reached the end. */
async function runIncremental(
  ctx: ScanRunContext,
  account: GmailAccount,
  query: string,
  budget: PageBudget,
): Promise<boolean> {
  let token: string | null = null
  do {
    if (budget.pages <= 0 || pastDeadline(ctx)) return false
    const page = await searchMessagesPage(ctx.userId, account.service, query, budget.pageSize, token)
    if (!page) return false
    budget.pages--
    await processIds(ctx, account, page.ids)
    token = page.nextPageToken
  } while (token)
  return true
}

/** Continue the backfill from `token`, saving the cursor after each page. */
async function runBackfill(
  ctx: ScanRunContext,
  account: GmailAccount,
  startToken: string | null,
  budget: PageBudget,
): Promise<boolean> {
  const query = `${SCAN_WINDOW} ${ACCOUNT_SIGNAL_QUERY}`
  let token = startToken
  while (budget.pages > 0 && !pastDeadline(ctx)) {
    const page = await searchMessagesPage(ctx.userId, account.service, query, budget.pageSize, token)
    if (!page) {
      console.warn(`[email] account backfill page failed for ${account.service}; will resume next run`)
      return false
    }
    budget.pages--
    await processIds(ctx, account, page.ids)
    token = page.nextPageToken
    await db.gmailScanState.update({
      where: { userId_service: { userId: ctx.userId, service: account.service } },
      data: {
        backfillPageToken: token,
        backfillDone: !token,
        processedCount: { increment: page.ids.length },
      },
    })
    if (!token) return true
  }
  return false
}

async function processIds(ctx: ScanRunContext, account: GmailAccount, ids: string[]) {
  const fresh = ids.filter((id) => !ctx.seen.has(id))
  bumpScan(ctx.userId, "scanned", ids.length)
  bumpScan(ctx.userId, "skipped", ids.length - fresh.length)
  for (const id of fresh) ctx.seen.add(id)

  await forEachConcurrent(fresh, SCAN_CONCURRENCY, async (id) => {
    try {
      const outcome = await processMessage(ctx, account, id)
      bumpScan(ctx.userId, outcome)
    } catch (err) {
      console.warn("[email] account scan failed for message:", (err as Error).message)
      bumpScan(ctx.userId, "skipped")
    }
  })
}

/**
 * Decide whether this message earns an LLM call: not when a row for the same
 * service + mailbox was already LLM-extracted (the heuristic merge is enough),
 * and not once the run's LLM budget is spent.
 */
function providerFor(ctx: ScanRunContext, domain: string, emailHash: string) {
  if (!ctx.providerConfig) return null
  if (!isRelayDomain(domain) && ctx.llmKnown.has(`${domain}|${emailHash}`)) return null
  if (ctx.llmCallsLeft <= 0) return null
  ctx.llmCallsLeft--
  bumpScan(ctx.userId, "llmCalls")
  return ctx.providerConfig
}

async function processMessage(
  ctx: ScanRunContext,
  account: GmailAccount,
  id: string,
): Promise<"imported" | "updated" | "skipped"> {
  const msg = await getMessage(ctx.userId, account.service, id)
  if (!msg || !msg.bodyText.trim()) return "skipped"

  const signal = classifySignal(msg)
  if (!signal) return "skipped"

  const mailboxEmail = account.email ?? ""
  const provider = providerFor(ctx, signal.serviceDomain, hashAccountEmail(mailboxEmail))
  const extracted = await extractAccount(msg, mailboxEmail, provider)
  if (!extracted || !extracted.accountEmail || !extracted.serviceDomain) return "skipped"

  if (extracted.extractedBy === "llm") {
    ctx.llmKnown.add(`${extracted.serviceDomain}|${hashAccountEmail(extracted.accountEmail)}`)
  }
  return upsertDiscoveredAccount(ctx.userId, account, msg, extracted)
}

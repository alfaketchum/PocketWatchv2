/**
 * Mailing-list sender scan for the unsubscribe manager.
 *
 * Per mailbox: search for mail containing "unsubscribe" (first run: the last
 * SENDER_SCAN_WINDOW; afterwards only mail after the saved watermark), fetch
 * HEADERS ONLY (From, Date, List-Unsubscribe, List-Unsubscribe-Post), and
 * aggregate per sender address into MailSender rows. No bodies, no LLM.
 */

import { db } from "@/lib/db"
import { forEachConcurrent } from "@/lib/async-pool"
import {
  getMessageHeaderMap,
  listGmailAccounts,
  searchMessagesPage,
  type GmailAccount,
} from "@/lib/integrations/gmail-client"
import { registrableDomain } from "./account-hash"
import { parseListUnsubscribe, type UnsubscribeOptions } from "./list-unsubscribe"
import { beginScan, bumpScan, finishScan, getScanStatus, isScanRunning } from "./account-scan-status"

const SENDER_SCAN_WINDOW = "newer_than:180d"
const SENDER_QUERY = "unsubscribe"
const PAGE_SIZE = 500
const MAX_MESSAGES_PER_MAILBOX = 3_000
const FETCH_CONCURRENCY = 8
const HEADERS = ["From", "Date", "List-Unsubscribe", "List-Unsubscribe-Post"] as const

/** Status-map key — sender scans share the tracker with account scans, namespaced. */
export function senderScanKey(userId: string): string {
  return `senders:${userId}`
}

interface SenderAggregate {
  displayName: string
  count: number
  first: Date | null
  last: Date | null
  options: UnsubscribeOptions
}

function parseFrom(from: string): { email: string; name: string } | null {
  const angle = from.match(/<([^>]+)>/)
  const email = (angle ? angle[1] : from).trim().toLowerCase()
  if (!email.includes("@")) return null
  const name = from.split("<")[0].replace(/["']/g, "").trim()
  return { email, name: name || email.split("@")[0] }
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function collectIds(userId: string, service: string, query: string): Promise<string[]> {
  const ids: string[] = []
  let token: string | null = null
  do {
    const page = await searchMessagesPage(userId, service, query, PAGE_SIZE, token)
    if (!page) break
    ids.push(...page.ids)
    token = page.nextPageToken
  } while (token && ids.length < MAX_MESSAGES_PER_MAILBOX)
  return ids.slice(0, MAX_MESSAGES_PER_MAILBOX)
}

async function aggregateMailbox(userId: string, account: GmailAccount, query: string) {
  const ids = await collectIds(userId, account.service, query)
  const bySender = new Map<string, SenderAggregate>()
  const key = senderScanKey(userId)

  await forEachConcurrent(ids, FETCH_CONCURRENCY, async (id) => {
    const h = await getMessageHeaderMap(userId, account.service, id, HEADERS)
    bumpScan(key, "scanned")
    const from = h ? parseFrom(h.From) : null
    const options = h ? parseListUnsubscribe(h["List-Unsubscribe"], h["List-Unsubscribe-Post"]) : null
    if (!h || !from || !options) return

    const date = parseDate(h.Date)
    const prev = bySender.get(from.email)
    const isNewest = !prev || (date && (!prev.last || date > prev.last))
    bySender.set(from.email, {
      displayName: isNewest ? from.name : prev.displayName,
      count: (prev?.count ?? 0) + 1,
      first: prev?.first && date && prev.first < date ? prev.first : (date ?? prev?.first ?? null),
      last: isNewest ? date : prev.last,
      options: isNewest ? options : prev.options,
    })
  })
  return bySender
}

async function saveSenders(userId: string, service: string, senders: Map<string, SenderAggregate>) {
  const key = senderScanKey(userId)
  for (const [senderEmail, agg] of senders) {
    const where = { userId_service_senderEmail: { userId, service, senderEmail } }
    const existing = await db.mailSender.findUnique({
      where,
      select: { id: true, messageCount: true, firstSeenAt: true, lastSeenAt: true },
    })
    const fields = {
      displayName: agg.displayName.slice(0, 120),
      unsubscribeUrl: agg.options.url,
      unsubscribeMailto: agg.options.mailto,
      oneClick: agg.options.oneClick,
    }
    if (!existing) {
      await db.mailSender.create({
        data: {
          userId,
          service,
          senderEmail,
          senderDomain: registrableDomain(senderEmail) || senderEmail.split("@")[1],
          messageCount: agg.count,
          firstSeenAt: agg.first,
          lastSeenAt: agg.last,
          ...fields,
        },
      })
      bumpScan(key, "imported")
      continue
    }
    const newer = !!agg.last && (!existing.lastSeenAt || agg.last > existing.lastSeenAt)
    await db.mailSender.update({
      where: { id: existing.id },
      data: {
        messageCount: existing.messageCount + agg.count,
        firstSeenAt:
          agg.first && (!existing.firstSeenAt || agg.first < existing.firstSeenAt) ? agg.first : existing.firstSeenAt,
        ...(newer ? { lastSeenAt: agg.last, ...fields } : {}),
      },
    })
    bumpScan(key, "updated")
  }
}

async function scanMailboxSenders(userId: string, account: GmailAccount) {
  const state = await db.gmailScanState.upsert({
    where: { userId_service: { userId, service: account.service } },
    create: { userId, service: account.service },
    update: {},
    select: { id: true, senderScanAt: true },
  })
  const runStartedAt = new Date()
  const bound = state.senderScanAt
    ? `after:${Math.floor(state.senderScanAt.getTime() / 1000)}`
    : SENDER_SCAN_WINDOW
  const senders = await aggregateMailbox(userId, account, `${bound} ${SENDER_QUERY}`)
  await saveSenders(userId, account.service, senders)
  await db.gmailScanState.update({ where: { id: state.id }, data: { senderScanAt: runStartedAt } })
}

export class SenderScanRunningError extends Error {
  constructor() {
    super("A sender scan is already running — wait for it to finish.")
  }
}

/** Start a background sender scan across all connected mailboxes. */
export function startSenderScan(userId: string): void {
  const key = senderScanKey(userId)
  if (isScanRunning(key)) throw new SenderScanRunningError()
  beginScan(key)
  ;(async () => {
    const accounts = await listGmailAccounts(userId)
    for (const account of accounts) await scanMailboxSenders(userId, account)
  })()
    .then(() => finishScan(key, null))
    .catch((err: unknown) => {
      console.error("[email] sender scan failed:", (err as Error).message)
      finishScan(key, err instanceof Error ? err.message : String(err))
    })
}

export function getSenderScanStatus(userId: string) {
  return getScanStatus(senderScanKey(userId))
}

/**
 * Targeted inbox lookup for recurring charges that have no directory entry.
 *
 * The user pays for the service, so its account almost certainly lives in one
 * of their connected mailboxes — the broad scan just never saw a qualifying
 * email. Search each mailbox for mail from the merchant (sender domain first,
 * then its name) and attribute the service to the mailbox with the most hits.
 * Only message headers are fetched — no email body is read or sent to an LLM.
 */

import { domainFromHost, registrableDomain } from "./account-hash"
import { SCAN_WINDOW, classifySignal, isRelayDomain } from "./account-signals"
import { upsertDiscoveredAccount } from "./account-upsert"
import {
  getMessageHeaders,
  searchMessagesPage,
  type GmailAccount,
  type GmailMessage,
} from "@/lib/integrations/gmail-client"
import { merchantNameToDomain } from "@/lib/finance/merchant-logos"

const LOOKUP_PAGE_SIZE = 25
const INFERRED_CONFIDENCE = 0.5

export interface LookupTarget {
  merchantName: string
  domain: string | null
  /**
   * Also search by merchant name. Only for recurring charges — for one-off
   * merchants a name hit (e.g. a café mentioned in a newsletter) proves nothing.
   */
  allowNameSearch: boolean
}

interface InboxHit {
  account: GmailAccount
  message: GmailMessage
  viaDomain: boolean
}

function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function senderHasName(from: string, name: string): boolean {
  const needle = compact(name)
  return needle.length >= 3 && compact(from).includes(needle)
}

function cleanName(name: string): string {
  return name.replace(/[^\p{L}\p{N}\s.&'-]/gu, " ").replace(/\s+/g, " ").trim()
}

async function bestMailbox(userId: string, accounts: GmailAccount[], query: string) {
  const pages = await Promise.all(
    accounts.map((a) => searchMessagesPage(userId, a.service, `${SCAN_WINDOW} ${query}`, LOOKUP_PAGE_SIZE)),
  )
  let best: { account: GmailAccount; ids: string[] } | null = null
  pages.forEach((page, i) => {
    if (page && page.ids.length > (best?.ids.length ?? 0)) best = { account: accounts[i], ids: page.ids }
  })
  return best as { account: GmailAccount; ids: string[] } | null
}

/** Find which mailbox holds mail from this merchant, or null if none does. */
export async function findInboxFor(
  userId: string,
  accounts: GmailAccount[],
  target: LookupTarget,
): Promise<InboxHit | null> {
  const name = cleanName(target.merchantName)
  const queries: { q: string; viaDomain: boolean }[] = []
  if (target.domain && !isRelayDomain(target.domain)) queries.push({ q: `from:${target.domain}`, viaDomain: true })
  // Sender only: a body/subject match is mostly newsletters mentioning the name.
  if (target.allowNameSearch && name.length >= 3) queries.push({ q: `from:"${name}"`, viaDomain: false })

  for (const { q, viaDomain } of queries) {
    const best = await bestMailbox(userId, accounts, q)
    if (!best) continue
    const message = await getMessageHeaders(userId, best.account.service, best.ids[0])
    // Gmail's from: is fuzzy — require the sender to actually carry the name.
    if (message && (viaDomain || senderHasName(message.from, name))) {
      return { account: best.account, message, viaDomain }
    }
  }
  return null
}

/**
 * Service domain for an inferred entry: the searched domain, else the sender's
 * (only when it isn't a relay), else a guess from the merchant name.
 */
function inferredDomain(target: LookupTarget, hit: InboxHit): string {
  if (hit.viaDomain && target.domain) return target.domain
  const sender = registrableDomain(hit.message.from)
  if (sender && !isRelayDomain(sender)) return sender
  return target.domain ?? merchantNameToDomain(target.merchantName) ?? domainFromHost(`${cleanName(target.merchantName).replace(/\s/g, "")}.com`)
}

/** Record the service under the mailbox the lookup found. */
export async function recordInferredAccount(userId: string, target: LookupTarget, hit: InboxHit) {
  const accountEmail = hit.account.email
  if (!accountEmail) return null
  return upsertDiscoveredAccount(userId, hit.account, hit.message, {
    isSignup: true,
    serviceName: cleanName(target.merchantName).slice(0, 60),
    serviceDomain: inferredDomain(target, hit),
    accountEmail,
    category: null,
    signalType: classifySignal(hit.message)?.signalType ?? "receipt",
    confidence: INFERRED_CONFIDENCE,
    extractedBy: "heuristic",
    paymentBrand: null,
    paymentLast4: null,
  })
}

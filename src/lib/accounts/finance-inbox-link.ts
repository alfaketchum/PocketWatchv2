/**
 * Finance → inbox linking: start from what the user pays for (recurring charges
 * and 12-month merchants) and find which connected mailbox holds that account.
 * The complement of the email-first scan, which only sees mail with signup-ish
 * subjects. MUST run in a request with withUserEncryption available.
 */

import { forEachConcurrent } from "@/lib/async-pool"
import { listGmailAccounts } from "@/lib/integrations/gmail-client"
import { isRelayDomain } from "@/lib/email/account-signals"
import {
  findInboxFor,
  recordInferredAccount,
  type LookupTarget,
} from "@/lib/email/account-inbox-lookup"
import { loadDirectory } from "./directory-query"
import { compactName, NON_SERVICE_RE, type FinanceIndex } from "./finance-index"
import { findMissingEmail, isMerchantListed } from "./finance-match"

const LOOKUP_CONCURRENCY = 3
const MAX_TARGETS_PER_RUN = 60
const MIN_MERCHANT_SPEND = 20
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Per-user lookup outcomes that are NOT persisted as directory entries, keyed by
 * compact merchant name: "none" = no inbox has mail from it; otherwise the inbox
 * that has only non-account mail (marketing) from it — a suggestion to confirm.
 */
interface LookupOutcome {
  suggestedEmail: string | null
  expiresAt: number
}
const outcomes = new Map<string, Map<string, LookupOutcome>>()

function getOutcome(userId: string, merchantName: string): LookupOutcome | null {
  const outcome = outcomes.get(userId)?.get(compactName(merchantName))
  return outcome && outcome.expiresAt > Date.now() ? outcome : null
}

function setOutcome(userId: string, merchantName: string, suggestedEmail: string | null) {
  const map = outcomes.get(userId) ?? new Map<string, LookupOutcome>()
  map.set(compactName(merchantName), { suggestedEmail, expiresAt: Date.now() + NEGATIVE_TTL_MS })
  outcomes.set(userId, map)
}

/** The last lookup result for a charge that has no directory entry (null = not looked up). */
export function lookupOutcomeFor(userId: string, merchantName: string) {
  const outcome = getOutcome(userId, merchantName)
  if (!outcome) return null
  return { notInInbox: outcome.suggestedEmail === null, suggestedEmail: outcome.suggestedEmail }
}

export interface FinanceLinkResult {
  checked: number
  linked: number
  suggested: number
  notFound: number
}

type Services = Awaited<ReturnType<typeof loadDirectory>>["services"]

/** Unmatched recurring charges first, then unmatched merchants by spend (domain known). */
export function buildTargets(userId: string, services: Services, index: FinanceIndex): LookupTarget[] {
  const recurring: LookupTarget[] = findMissingEmail(services, index).map((m) => ({
    merchantName: m.merchantName,
    domain: m.domain,
    allowNameSearch: true,
  }))

  const matchedNames = new Set(recurring.map((t) => compactName(t.merchantName)))
  const merchants: LookupTarget[] = index.merchants
    .filter((m) => m.total >= MIN_MERCHANT_SPEND && !NON_SERVICE_RE.test(m.merchantName))
    .sort((a, b) => b.total - a.total)
    .flatMap((m) => {
      const domain = [...m.domains].find((d) => !isRelayDomain(d) && !index.institutions.has(d))
      if (!domain || matchedNames.has(m.compact)) return []
      if (isMerchantListed(services, m.domains, m.compact)) return []
      return [{ merchantName: m.merchantName, domain, allowNameSearch: false }]
    })

  return [...recurring, ...merchants]
    .filter((t) => !getOutcome(userId, t.merchantName))
    .slice(0, MAX_TARGETS_PER_RUN)
}

export async function linkFinancesToInboxes(userId: string): Promise<FinanceLinkResult> {
  const accounts = (await listGmailAccounts(userId)).filter((a) => a.email)
  if (accounts.length === 0) return { checked: 0, linked: 0, suggested: 0, notFound: 0 }

  const { services, index } = await loadDirectory(userId, "active")
  const targets = buildTargets(userId, services, index)
  let linked = 0
  let suggested = 0
  let missing = 0

  await forEachConcurrent(targets, LOOKUP_CONCURRENCY, async (target) => {
    try {
      const hit = await findInboxFor(userId, accounts, target)
      if (!hit) {
        setOutcome(userId, target.merchantName, null)
        missing++
      } else if (hit.accountMail) {
        // Account mail proves where the account lives — record it.
        if (await recordInferredAccount(userId, target, hit)) linked++
      } else {
        // Only marketing-type mail: likely the right inbox, but let the user confirm.
        setOutcome(userId, target.merchantName, hit.account.email)
        suggested++
      }
    } catch (err) {
      console.warn("[accounts] finance inbox lookup failed:", (err as Error).message)
    }
  })

  return { checked: targets.length, linked, suggested, notFound: missing }
}

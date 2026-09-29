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

// userId → (compact merchant name → expiry) for merchants no inbox had mail from.
const notFound = new Map<string, Map<string, number>>()

export function isKnownNotFound(userId: string, merchantName: string): boolean {
  const expiry = notFound.get(userId)?.get(compactName(merchantName))
  return !!expiry && expiry > Date.now()
}

function markNotFound(userId: string, merchantName: string) {
  const map = notFound.get(userId) ?? new Map<string, number>()
  map.set(compactName(merchantName), Date.now() + NEGATIVE_TTL_MS)
  notFound.set(userId, map)
}

export interface FinanceLinkResult {
  checked: number
  linked: number
  notFound: number
}

type Services = Awaited<ReturnType<typeof loadDirectory>>["services"]

/** Unmatched recurring charges first, then unmatched merchants by spend (domain known). */
function buildTargets(userId: string, services: Services, index: FinanceIndex): LookupTarget[] {
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
    .filter((t) => !isKnownNotFound(userId, t.merchantName))
    .slice(0, MAX_TARGETS_PER_RUN)
}

export async function linkFinancesToInboxes(userId: string): Promise<FinanceLinkResult> {
  const accounts = (await listGmailAccounts(userId)).filter((a) => a.email)
  if (accounts.length === 0) return { checked: 0, linked: 0, notFound: 0 }

  const { services, index } = await loadDirectory(userId, "active")
  const targets = buildTargets(userId, services, index)
  let linked = 0
  let missing = 0

  await forEachConcurrent(targets, LOOKUP_CONCURRENCY, async (target) => {
    try {
      const hit = await findInboxFor(userId, accounts, target)
      if (!hit) {
        markNotFound(userId, target.merchantName)
        missing++
        return
      }
      if (await recordInferredAccount(userId, target, hit)) linked++
    } catch (err) {
      console.warn("[accounts] finance inbox lookup failed:", (err as Error).message)
    }
  })

  return { checked: targets.length, linked, notFound: missing }
}

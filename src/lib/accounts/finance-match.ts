/**
 * Match directory services (domain + name) to the finance index: who pays for
 * it, what it costs, and whether it is one of the user's own institutions.
 *
 * A finance entry matches a service when its domain equals the service domain,
 * or when compact names agree (exactly, or by containment for names ≥ 5 chars,
 * so "FRACTALTECH.XYZ" matches "Fractal Tech" but "Link" can't match "LinkedIn").
 */

import type {
  DirectoryFinance,
  DirectoryPaidWith,
  MissingEmailService,
  PaidWithSource,
} from "@/types/accounts-directory"
import { compactName, type FinanceIndex, type RecurringEntry } from "./finance-index"

const MIN_EXACT_NAME = 3
const MIN_CONTAINED_NAME = 5
// Domain labels too generic to identify a brand ("service.gov.uk", "my.app").
const GENERIC_LABELS = new Set([
  "service", "services", "mail", "email", "account", "accounts", "app", "apps", "my",
  "secure", "login", "info", "support", "notifications", "notify", "team", "hello",
  "news", "online", "portal", "billing", "payments", "shop", "store", "home",
])

export interface MatchableService {
  domain: string
  /** Every domain merged into this service (defaults to [domain]). */
  domains?: string[]
  name: string
  emails: { paymentLast4: string | null; paymentAccountId: string | null }[]
}

interface ServiceKeys {
  domains: string[]
  name: string
  label: string
}

function keysFor(service: { domain: string; name: string; domains?: string[] }): ServiceKeys {
  const label = compactName(service.domain.split(".")[0] ?? "")
  return {
    domains: service.domains ?? [service.domain],
    name: compactName(service.name),
    label: GENERIC_LABELS.has(label) ? "" : label,
  }
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return a.length >= MIN_EXACT_NAME
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= MIN_CONTAINED_NAME && long.includes(short)
}

/**
 * Match strength: 3 = same domain, 2 = service name, 1 = domain label, 0 = none.
 * The service name outranks the domain label so "Wolt (appleid.com)" prefers
 * the Wolt subscription over an Apple one.
 */
function matchScore(keys: ServiceKeys, domains: Iterable<string>, compact: string): number {
  for (const d of domains) if (keys.domains.includes(d)) return 3
  if (namesMatch(keys.name, compact)) return 2
  return namesMatch(keys.label, compact) ? 1 : 0
}

function recurringScore(keys: ServiceKeys, entry: RecurringEntry): number {
  return matchScore(keys, entry.domain ? [entry.domain] : [], entry.compact)
}

function bestRecurring(keys: ServiceKeys, index: FinanceIndex): RecurringEntry | null {
  let best: RecurringEntry | null = null
  let bestScore = 0
  for (const entry of index.recurring) {
    const score = recurringScore(keys, entry)
    if (score > bestScore) {
      best = entry
      bestScore = score
    }
  }
  return best
}

export function matchService(service: MatchableService, index: FinanceIndex): DirectoryFinance {
  const keys = keysFor(service)
  const paidWith: DirectoryPaidWith[] = []
  const add = (accountId: string | null, source: PaidWithSource) => {
    const account = accountId ? index.accounts.get(accountId) : undefined
    if (!account || paidWith.some((p) => p.accountId === account.id)) return
    paidWith.push({
      accountId: account.id,
      name: account.name,
      mask: account.mask,
      institution: account.institution,
      source,
    })
  }

  for (const email of service.emails) add(email.paymentAccountId, "manual")
  for (const email of service.emails) {
    if (!email.paymentLast4) continue
    const card = [...index.accounts.values()].find((a) => a.mask === email.paymentLast4)
    add(card?.id ?? null, "receipt")
  }

  const recurring = bestRecurring(keys, index)
  add(recurring?.accountId ?? null, "subscription")

  const spend = summarizeSpend(keys, index)
  add(spend.topAccountId, "transactions")

  return {
    paidWith,
    recurring: recurring
      ? {
          merchantName: recurring.merchantName,
          amount: recurring.amount,
          frequency: recurring.frequency,
          nextChargeDate: recurring.nextChargeDate?.toISOString() ?? null,
        }
      : null,
    lastChargeDate: spend.lastDate?.toISOString() ?? null,
    spend12m: Math.round(spend.total * 100) / 100,
    institution:
      keys.domains.map((d) => index.institutions.get(d)).find((name) => !!name) ?? null,
  }
}

function summarizeSpend(keys: ServiceKeys, index: FinanceIndex) {
  let total = 0
  let lastDate: Date | null = null
  const counts = new Map<string, number>()
  for (const m of index.merchants) {
    if (matchScore(keys, m.domains, m.compact) === 0) continue
    total += m.total
    if (!lastDate || m.lastDate > lastDate) lastDate = m.lastDate
    for (const [accountId, n] of m.countByAccount) {
      counts.set(accountId, (counts.get(accountId) ?? 0) + n)
    }
  }
  const topAccountId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { total, lastDate, topAccountId }
}

/** True when some directory service already accounts for this merchant. */
export function isMerchantListed(
  services: { domain: string; name: string; domains?: string[] }[],
  domains: Iterable<string>,
  compact: string,
): boolean {
  const list = [...domains]
  return services.some((s) => matchScore(keysFor(s), list, compact) > 0)
}

/** Recurring charges that no directory service accounts for. */
export function findMissingEmail(
  services: { domain: string; name: string; domains?: string[] }[],
  index: FinanceIndex,
): Omit<MissingEmailService, "notInInbox" | "suggestedEmail">[] {
  const allKeys = services.map(keysFor)
  return index.recurring
    .filter((entry) => !allKeys.some((keys) => recurringScore(keys, entry) > 0))
    .map((entry) => {
      const account = entry.accountId ? index.accounts.get(entry.accountId) : undefined
      return {
        merchantName: entry.merchantName,
        domain: entry.domain,
        amount: entry.amount,
        frequency: entry.frequency,
        nextChargeDate: entry.nextChargeDate?.toISOString() ?? null,
        paidWith: account
          ? {
              accountId: account.id,
              name: account.name,
              mask: account.mask,
              institution: account.institution,
              source: "subscription" as const,
            }
          : null,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

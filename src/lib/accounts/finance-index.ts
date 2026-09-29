/**
 * Finance index for the accounts directory: the user's payment accounts,
 * recurring charges and 12-month merchant spend, each tagged with a domain and a
 * compact name so directory services can be matched to them.
 *
 * MUST run inside withUserEncryption — transaction `website` is encrypted with
 * the per-user key.
 */

import { db } from "@/lib/db"
import { domainFromHost } from "@/lib/email/account-hash"
import { knownMerchantDomain, merchantNameToDomain } from "@/lib/finance/merchant-logos"
import { institutionNameToDomain } from "@/lib/finance/institution-logos"
import { fromExchangeServiceName, getExchangeById } from "@/lib/portfolio/exchanges"
import type { DirectoryPaymentAccount } from "@/types/accounts-directory"

const SPEND_WINDOW_DAYS = 365
const MAX_TRANSACTIONS = 5_000
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "suggested"]
// Recurring outflows that are money movement, not a service you have an account with.
const NON_SERVICE_RE =
  /autopay|crcardpmt|card\s*pmt|ach\s*pmt|credit\s*crd|epay|zelle|venmo|transfer|payment to|interest charge|membership fee|annual fee|late fee|overdraft/i
const NON_SERVICE_BILL_TYPES = new Set(["cc_payment", "cc_annual_fee"])
const TRAILING_MASK_RE = /\s*[•·*x]{2,}\s*\d{2,4}\s*$/i

export interface RecurringEntry {
  merchantName: string
  compact: string
  domain: string | null
  amount: number
  frequency: string
  nextChargeDate: Date | null
  accountId: string | null
}

export interface MerchantSpend {
  merchantName: string
  compact: string
  domains: Set<string>
  total: number
  lastDate: Date
  countByAccount: Map<string, number>
}

export interface FinanceIndex {
  accounts: Map<string, DirectoryPaymentAccount>
  recurring: RecurringEntry[]
  merchants: MerchantSpend[]
  /** Registrable domain → institution / exchange display name. */
  institutions: Map<string, string>
}

/** Lowercase alphanumerics only — "FRACTALTECH.XYZ" → "fractaltechxyz". */
export function compactName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export async function loadFinanceIndex(userId: string): Promise<FinanceIndex> {
  const [accounts, recurring, merchants, institutions] = await Promise.all([
    loadPaymentAccounts(userId),
    loadRecurring(userId),
    loadMerchantSpend(userId),
    loadInstitutions(userId),
  ])
  return { accounts, recurring, merchants, institutions }
}

async function loadPaymentAccounts(userId: string) {
  const [rows, profiles] = await Promise.all([
    db.financeAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        mask: true,
        type: true,
        institution: { select: { institutionName: true } },
      },
      take: 200,
    }),
    db.creditCardProfile.findMany({
      where: { userId },
      select: { accountId: true, cardName: true },
      take: 200,
    }),
  ])
  const cardNames = new Map(profiles.map((p) => [p.accountId, p.cardName]))
  const map = new Map<string, DirectoryPaymentAccount>()
  for (const a of rows) {
    const display = (cardNames.get(a.id) ?? a.name).replace(TRAILING_MASK_RE, "").trim()
    map.set(a.id, {
      id: a.id,
      name: display || a.name,
      mask: a.mask,
      institution: a.institution.institutionName,
      type: a.type,
    })
  }
  return map
}

async function loadRecurring(userId: string): Promise<RecurringEntry[]> {
  const [subs, streams] = await Promise.all([
    db.financeSubscription.findMany({
      where: { userId, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
      select: {
        merchantName: true,
        nickname: true,
        amount: true,
        frequency: true,
        nextChargeDate: true,
        accountId: true,
        billType: true,
      },
      take: 500,
    }),
    db.financeRecurringStream.findMany({
      where: { userId, streamType: "outflow", isActive: true },
      select: {
        merchantName: true,
        description: true,
        averageAmount: true,
        lastAmount: true,
        frequency: true,
        accountId: true,
      },
      take: 500,
    }),
  ])

  const serviceSubs = subs.filter(
    (s) => !NON_SERVICE_BILL_TYPES.has(s.billType ?? "") && !NON_SERVICE_RE.test(s.merchantName),
  )
  const entries: RecurringEntry[] = serviceSubs.map((s) => ({
    merchantName: s.nickname || s.merchantName,
    compact: compactName(s.merchantName),
    domain: merchantNameToDomain(s.merchantName),
    amount: s.amount,
    frequency: s.frequency,
    nextChargeDate: s.nextChargeDate,
    accountId: s.accountId,
  }))
  const seen = new Set(entries.map((e) => e.compact))
  for (const st of streams) {
    const name = st.merchantName || st.description
    const compact = compactName(name)
    if (!compact || seen.has(compact) || NON_SERVICE_RE.test(name)) continue
    seen.add(compact)
    entries.push({
      merchantName: name,
      compact,
      domain: merchantNameToDomain(name),
      amount: Math.abs(st.lastAmount ?? st.averageAmount ?? 0),
      frequency: st.frequency.toLowerCase(),
      nextChargeDate: null,
      accountId: st.accountId,
    })
  }
  return entries
}

async function loadMerchantSpend(userId: string): Promise<MerchantSpend[]> {
  const since = new Date(Date.now() - SPEND_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const txs = await db.financeTransaction.findMany({
    where: {
      userId,
      isDuplicate: false,
      isExcluded: false,
      amount: { gt: 0 },
      date: { gte: since },
      merchantName: { not: null },
    },
    select: { merchantName: true, website: true, amount: true, date: true, accountId: true },
    orderBy: { date: "desc" },
    take: MAX_TRANSACTIONS,
  })

  const byName = new Map<string, MerchantSpend>()
  for (const tx of txs) {
    const name = tx.merchantName ?? ""
    const compact = compactName(name)
    if (!compact) continue
    const entry = byName.get(compact) ?? {
      merchantName: name,
      compact,
      domains: new Set<string>(),
      total: 0,
      lastDate: tx.date,
      countByAccount: new Map<string, number>(),
    }
    const site = tx.website ? domainFromHost(tx.website) : ""
    const domain = site || knownMerchantDomain(name)
    if (domain) entry.domains.add(domain)
    entry.total += tx.amount
    if (tx.date > entry.lastDate) entry.lastDate = tx.date
    entry.countByAccount.set(tx.accountId, (entry.countByAccount.get(tx.accountId) ?? 0) + 1)
    byName.set(compact, entry)
  }
  return [...byName.values()]
}

async function loadInstitutions(userId: string): Promise<Map<string, string>> {
  const [institutions, exchangeKeys] = await Promise.all([
    db.financeInstitution.findMany({
      where: { userId },
      select: { institutionName: true },
      take: 100,
    }),
    db.externalApiKey.findMany({
      where: { userId, serviceName: { startsWith: "exchange_" } },
      select: { serviceName: true },
      take: 50,
    }),
  ])
  const map = new Map<string, string>()
  for (const inst of institutions) {
    const domain = institutionNameToDomain(inst.institutionName)
    if (domain) map.set(domain, inst.institutionName)
  }
  for (const key of exchangeKeys) {
    const id = fromExchangeServiceName(key.serviceName)
    const exchange = id ? getExchangeById(id) : undefined
    if (exchange) map.set(exchange.domain, exchange.label)
  }
  return map
}

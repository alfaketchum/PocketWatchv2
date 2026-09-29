/**
 * Build the accounts directory: group DiscoveredAccount rows into one service per
 * domain, attach finance matches, then filter / facet / sort / paginate.
 */

import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import { withUserEncryption } from "@/lib/auth"
import type {
  DirectoryEmail,
  DirectoryFacetOption,
  DirectoryFacets,
  DirectoryLinkFilter,
  DirectoryResponse,
  DirectoryService,
  DirectorySignalType,
} from "@/types/accounts-directory"
import { compactName, loadFinanceIndex, type FinanceIndex } from "./finance-index"
import { matchService } from "./finance-match"

const MAX_ROWS = 5_000

export type DirectorySort = "name" | "spend" | "recent"

export interface DirectoryQuery {
  status: "active" | "dismissed"
  q?: string
  emailHash?: string
  category?: string
  accountId?: string
  link: DirectoryLinkFilter
  sort: DirectorySort
  page: number
  limit: number
}

interface ServiceWithHashes extends DirectoryService {
  emailHashes: string[]
}

const ROW_SELECT = {
  id: true,
  serviceName: true,
  serviceDomain: true,
  category: true,
  accountEmail: true,
  accountEmailHash: true,
  signalTypes: true,
  firstSeenAt: true,
  lastSeenAt: true,
  paymentBrand: true,
  paymentLast4: true,
  paymentAccountId: true,
  evidence: true,
  status: true,
} satisfies Prisma.DiscoveredAccountSelect

type SelectedRow = Prisma.DiscoveredAccountGetPayload<{ select: typeof ROW_SELECT }>

/** Load rows (global key) and the finance index (per-user key) for one user. */
export async function loadDirectory(userId: string, status: "active" | "dismissed") {
  const rows = await db.discoveredAccount.findMany({
    where: { userId, status },
    select: ROW_SELECT,
    orderBy: { confidence: "desc" },
    take: MAX_ROWS,
  })
  const index = await withUserEncryption(() => loadFinanceIndex(userId))
  return { services: groupServices(rows, index), index }
}

function toEmail(row: SelectedRow): DirectoryEmail {
  const ev = row.evidence as { subject?: string; from?: string } | null
  return {
    id: row.id,
    email: row.accountEmail,
    signalTypes: row.signalTypes as DirectorySignalType[],
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt?.toISOString() ?? null,
    paymentBrand: row.paymentBrand,
    paymentLast4: row.paymentLast4,
    paymentAccountId: row.paymentAccountId,
    evidence: ev ? { subject: ev.subject ?? "", from: ev.from ?? "" } : null,
  }
}

/**
 * Rows arrive highest-confidence first, so the first row per domain names the
 * service. Domains whose services share a name ("Lenovo" from lenovo.com and a
 * shipping-tracker domain) are then merged into one service.
 */
export function groupServices(rows: SelectedRow[], index: FinanceIndex): ServiceWithHashes[] {
  const byDomain = new Map<string, SelectedRow[]>()
  for (const row of rows) {
    byDomain.set(row.serviceDomain, [...(byDomain.get(row.serviceDomain) ?? []), row])
  }

  const byName = new Map<string, SelectedRow[][]>()
  for (const group of byDomain.values()) {
    const key = compactName(group[0].serviceName) || group[0].serviceDomain
    byName.set(key, [...(byName.get(key) ?? []), group])
  }

  return [...byName.values()].map((groups) => {
    const primary = [...groups].sort((a, b) => b.length - a.length)[0]
    const all = groups.flat()
    const service = {
      domain: primary[0].serviceDomain,
      domains: groups.map((g) => g[0].serviceDomain),
      name: primary[0].serviceName,
      category: all.find((r) => r.category)?.category ?? null,
      status: primary[0].status as "active" | "dismissed",
      emails: all.map(toEmail),
      emailHashes: all.map((r) => r.accountEmailHash),
    }
    return { ...service, finance: matchService(service, index) }
  })
}

function isLinked(s: DirectoryService): boolean {
  return s.finance.paidWith.length > 0 || !!s.finance.recurring || s.finance.spend12m > 0
}

function matchesQuery(s: ServiceWithHashes, q: DirectoryQuery): boolean {
  if (q.q) {
    const needle = q.q.toLowerCase()
    const inDomains = s.domains.some((d) => d.includes(needle))
    if (!s.name.toLowerCase().includes(needle) && !inDomains) return false
  }
  if (q.emailHash && !s.emailHashes.includes(q.emailHash)) return false
  if (q.category && s.category !== q.category) return false
  if (q.accountId && !s.finance.paidWith.some((p) => p.accountId === q.accountId)) return false
  if (q.link === "linked" && !isLinked(s)) return false
  if (q.link === "unlinked" && isLinked(s)) return false
  return true
}

function lastActivity(s: DirectoryService): string {
  const dates = [s.finance.lastChargeDate, ...s.emails.map((e) => e.lastSeenAt)]
  return dates.filter((d): d is string => !!d).sort().at(-1) ?? ""
}

const SORTERS: Record<DirectorySort, (a: DirectoryService, b: DirectoryService) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  spend: (a, b) => b.finance.spend12m - a.finance.spend12m || a.name.localeCompare(b.name),
  recent: (a, b) => lastActivity(b).localeCompare(lastActivity(a)),
}

function countOptions(entries: [string, string][]): DirectoryFacetOption[] {
  const counts = new Map<string, DirectoryFacetOption>()
  for (const [value, label] of entries) {
    const opt = counts.get(value) ?? { value, label, count: 0 }
    counts.set(value, { ...opt, count: opt.count + 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

function buildFacets(services: ServiceWithHashes[]): DirectoryFacets {
  return {
    emails: countOptions(
      services.flatMap((s) => s.emails.map((e, i): [string, string] => [s.emailHashes[i], e.email])),
    ),
    cards: countOptions(
      services.flatMap((s) =>
        s.finance.paidWith.map((p): [string, string] => [
          p.accountId,
          p.mask ? `${p.name} ••${p.mask}` : p.name,
        ]),
      ),
    ),
    categories: countOptions(
      services.filter((s) => s.category).map((s): [string, string] => [s.category!, s.category!]),
    ),
  }
}

export function queryDirectory(
  services: ServiceWithHashes[],
  index: FinanceIndex,
  q: DirectoryQuery,
): DirectoryResponse {
  const filtered = services.filter((s) => matchesQuery(s, q)).sort(SORTERS[q.sort])
  const start = (q.page - 1) * q.limit
  return {
    services: filtered.slice(start, start + q.limit).map(({ emailHashes: _hashes, ...s }) => s),
    total: filtered.length,
    page: q.page,
    limit: q.limit,
    facets: buildFacets(services),
    paymentAccounts: [...index.accounts.values()],
  }
}

/**
 * Formatting + grouping helpers for the accounts directory list.
 */

import { formatCurrency } from "@/lib/utils"
import type {
  DirectoryPaidWith,
  DirectoryRecurring,
  DirectoryService,
  PaidWithSource,
} from "@/types/accounts-directory"

export type DirectoryGroupBy = "none" | "email" | "card"

export const GROUP_BY_VIEWS: ReadonlyArray<{ key: DirectoryGroupBy; label: string }> = [
  { key: "none", label: "All" },
  { key: "email", label: "By email" },
  { key: "card", label: "By card" },
]

export const LINK_VIEWS: ReadonlyArray<{ key: "all" | "linked" | "unlinked"; label: string }> = [
  { key: "all", label: "All" },
  { key: "linked", label: "Linked to finances" },
  { key: "unlinked", label: "Not linked" },
]

export const SOURCE_LABELS: Record<PaidWithSource, string> = {
  manual: "Set by you",
  receipt: "From a receipt",
  subscription: "From a subscription",
  transactions: "From your charges",
}

const FREQUENCY_SUFFIX: Record<string, string> = {
  weekly: "/wk",
  biweekly: "/2wk",
  monthly: "/mo",
  quarterly: "/qtr",
  semi_annually: "/6mo",
  annually: "/yr",
  yearly: "/yr",
}

export function recurringLabel(r: DirectoryRecurring): string {
  return `${formatCurrency(r.amount)}${FREQUENCY_SUFFIX[r.frequency] ?? ` ${r.frequency}`}`
}

export function paidWithLabel(p: Pick<DirectoryPaidWith, "name" | "mask">): string {
  return p.mask ? `${p.name} ••${p.mask}` : p.name
}

export function dateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/** Most recent of the last charge and the last email seen. */
export function lastActivityIso(s: DirectoryService): string | null {
  const dates = [s.finance.lastChargeDate, ...s.emails.map((e) => e.lastSeenAt)]
  return dates.filter((d): d is string => !!d).sort().at(-1) ?? null
}

export interface DirectorySection {
  key: string
  label: string
  services: DirectoryService[]
}

const UNASSIGNED = "__none__"

/** Split services into sections; a service with two emails/cards appears under each. */
export function groupDirectory(
  services: DirectoryService[],
  groupBy: DirectoryGroupBy,
): DirectorySection[] {
  if (groupBy === "none") return [{ key: "all", label: "", services }]

  const sections = new Map<string, DirectorySection>()
  const push = (key: string, label: string, service: DirectoryService) => {
    const section = sections.get(key) ?? { key, label, services: [] }
    sections.set(key, { ...section, services: [...section.services, service] })
  }

  for (const s of services) {
    if (groupBy === "email") {
      for (const email of new Set(s.emails.map((e) => e.email))) push(email, email, s)
      continue
    }
    if (s.finance.paidWith.length === 0) push(UNASSIGNED, "No card found", s)
    for (const p of s.finance.paidWith) push(p.accountId, paidWithLabel(p), s)
  }

  return [...sections.values()].sort((a, b) => {
    if (a.key === UNASSIGNED) return 1
    if (b.key === UNASSIGNED) return -1
    return b.services.length - a.services.length
  })
}

/**
 * Shared account grouping for the Net Worth breakdown (page + sidebar).
 * Groups finance accounts into Personal-Capital-style buckets.
 */

export type GroupKey = "cash" | "investment" | "credit" | "loan" | "other"

export const GROUP_META: Record<GroupKey, { label: string; icon: string; kind: "asset" | "liability" }> = {
  cash:       { label: "Cash",         icon: "account_balance",        kind: "asset" },
  investment: { label: "Investments",  icon: "trending_up",            kind: "asset" },
  other:      { label: "Other",        icon: "account_balance_wallet", kind: "asset" },
  credit:     { label: "Credit Cards", icon: "credit_card",            kind: "liability" },
  loan:       { label: "Loans",        icon: "request_quote",          kind: "liability" },
}

export const ASSET_ORDER: GroupKey[] = ["cash", "investment", "other"]
export const LIABILITY_ORDER: GroupKey[] = ["credit", "loan"]

export function groupOf(type: string): GroupKey {
  switch (type) {
    case "checking": case "savings": case "depository": case "cash": return "cash"
    case "investment": case "brokerage": return "investment"
    case "credit": case "business_credit": return "credit"
    case "loan": case "mortgage": return "loan"
    default: return "other"
  }
}

export function agoLabel(iso: string | null): string {
  if (!iso) return ""
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export interface AccountRow {
  id: string
  name: string
  mask: string | null
  type: string
  balance: number
  synced: string | null
  needsReconnect: boolean
}

interface InstitutionLike {
  provider: string
  status: string
  lastSyncedAt: string | null
  accounts: Array<{
    id: string
    name: string
    officialName: string | null
    type: string
    mask: string | null
    currentBalance: number | null
    isHidden: boolean
  }>
}

/** Group all visible accounts across institutions into the bucket map. */
export function buildAccountGroups(
  institutions: InstitutionLike[] | undefined,
): Record<GroupKey, AccountRow[]> {
  const groups: Record<GroupKey, AccountRow[]> = { cash: [], investment: [], other: [], credit: [], loan: [] }
  for (const inst of institutions ?? []) {
    const needsReconnect = inst.status === "error" && inst.provider !== "manual"
    for (const a of inst.accounts) {
      if (a.isHidden) continue
      groups[groupOf(a.type)].push({
        id: a.id,
        name: a.officialName || a.name,
        mask: a.mask,
        type: a.type,
        balance: a.currentBalance ?? 0,
        synced: inst.lastSyncedAt,
        needsReconnect,
      })
    }
  }
  return groups
}

export function sumGroups(groups: Record<GroupKey, AccountRow[]>, keys: GroupKey[]): number {
  return keys.reduce((sum, k) => sum + groups[k].reduce((s, r) => s + r.balance, 0), 0)
}

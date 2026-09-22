/**
 * Duplicate-subscription detection and collapsing.
 *
 * Concurrent detection runs (multiple sync flows + the manual "Detect" button)
 * can each find-or-create the same subscription before the other commits,
 * leaving byte-identical rows. These helpers collapse those duplicates — both
 * defensively on read and as a self-healing step at the end of each detect run.
 */

/** Lower rank = more worth keeping when collapsing a duplicate group. */
const STATUS_RANK: Record<string, number> = {
  active: 0, paused: 1, flagged: 2, suggested: 3, cancelled: 4, dismissed: 5,
}

export interface DedupeRow {
  id: string
  merchantName: string
  amount: number
  frequency: string
  status: string
  lastTransactionId?: string | null
  nickname?: string | null
  notes?: string | null
  createdAt?: Date | string | null
}

function groupKey(r: { merchantName: string; amount: number; frequency: string }): string {
  return `${r.merchantName.trim().toLowerCase()}|${r.amount.toFixed(2)}|${r.frequency}`
}

/** True when `a` should be kept over `b` within a duplicate group. */
function keepsOver(a: DedupeRow, b: DedupeRow): boolean {
  const ra = STATUS_RANK[a.status] ?? 9
  const rb = STATUS_RANK[b.status] ?? 9
  if (ra !== rb) return ra < rb
  // User-curated (nickname/notes) beats untouched
  const curatedA = !!(a.nickname || a.notes)
  const curatedB = !!(b.nickname || b.notes)
  if (curatedA !== curatedB) return curatedA
  // A row with a proof transaction beats one without
  const proofA = !!a.lastTransactionId
  const proofB = !!b.lastTransactionId
  if (proofA !== proofB) return proofA
  // Otherwise keep the newer row
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
  return ta >= tb
}

/**
 * Given a set of subscription rows, return the IDs of the duplicates that
 * should be deleted (keeping the single best row per merchant+amount+frequency).
 */
export function duplicateIdsToDelete(rows: DedupeRow[]): string[] {
  const winners = new Map<string, DedupeRow>()
  const toDelete: string[] = []
  for (const row of rows) {
    const key = groupKey(row)
    const current = winners.get(key)
    if (!current) {
      winners.set(key, row)
      continue
    }
    if (keepsOver(row, current)) {
      toDelete.push(current.id)
      winners.set(key, row)
    } else {
      toDelete.push(row.id)
    }
  }
  return toDelete
}

/**
 * Collapse duplicates in a merged/unified subscription list on read — keeps one
 * entry per merchant+amount+frequency so the UI never shows a duplicate even if
 * the DB briefly holds one (or a Plaid virtual mirrors a detected row).
 */
export function dedupeUnified<T extends { id: string; merchantName: string; amount: number; frequency: string; status: string }>(
  subs: T[],
): T[] {
  const keepId = new Map<string, string>()
  const winners = new Map<string, T>()
  for (const s of subs) {
    const key = groupKey(s)
    const current = winners.get(key)
    if (!current || keepsOver(s as unknown as DedupeRow, current as unknown as DedupeRow)) {
      winners.set(key, s)
      keepId.set(key, s.id)
    }
  }
  return subs.filter((s) => keepId.get(groupKey(s)) === s.id)
}

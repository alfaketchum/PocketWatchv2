import type { CategoryStats, DraftDiff, DraftLine, ExistingBudget } from "./budget-builder-types"

export const HISTORY_MONTHS = 6

interface TrendMonth { month: string; income: number; categories: Record<string, number> }
interface Suggestion { category: string; suggested: number }
interface ProposalLine { category: string; amount: number; reason: string }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Trend months with the in-progress current month dropped, newest HISTORY_MONTHS kept. */
export function completeTrendMonths<T extends { month: string }>(months: T[] | undefined, now = new Date()): T[] {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  return (months ?? []).filter((m) => m.month < current).slice(-HISTORY_MONTHS)
}

export function buildCategoryStats(months: TrendMonth[]): Map<string, CategoryStats> {
  const out = new Map<string, CategoryStats>()
  if (months.length === 0) return out
  const cats = new Set(months.flatMap((m) => Object.keys(m.categories)))
  for (const cat of cats) {
    const history = months.map((m) => m.categories[cat] ?? 0)
    out.set(cat, {
      history,
      avgMonthly: round2(history.reduce((s, v) => s + v, 0) / months.length),
      lastMonth: history[history.length - 1] ?? 0,
    })
  }
  return out
}

export function avgMonthlyIncome(months: TrendMonth[]): number {
  if (months.length === 0) return 0
  return round2(months.reduce((s, m) => s + m.income, 0) / months.length)
}

function line(category: string, amount: number, stats: Map<string, CategoryStats>, reason?: string): DraftLine {
  const s = stats.get(category)
  return { category, amount, avgMonthly: s?.avgMonthly ?? 0, lastMonth: s?.lastMonth ?? 0, reason, locked: false }
}

const byAmountDesc = (a: DraftLine, b: DraftLine) => b.amount - a.amount

/** Existing budgets at their current amounts; optionally plus suggested categories not yet budgeted. */
export function buildInitialDraft(
  existing: ExistingBudget[],
  suggestions: Suggestion[],
  stats: Map<string, CategoryStats>,
  includeSuggestions: boolean,
): DraftLine[] {
  const lines = existing.map((b) => line(b.category, b.monthlyLimit, stats))
  if (!includeSuggestions) return lines.sort(byAmountDesc)
  const have = new Set(existing.map((b) => b.category))
  const extra = suggestions
    .filter((s) => !have.has(s.category) && s.suggested > 0)
    .map((s) => line(s.category, s.suggested, stats))
  return [...lines, ...extra].sort(byAmountDesc)
}

/** AI proposal lines, plus any existing budget the AI left out (kept, never silently removed). */
export function draftFromProposal(
  proposal: ProposalLine[],
  existing: ExistingBudget[],
  stats: Map<string, CategoryStats>,
): DraftLine[] {
  const proposed = new Set(proposal.map((p) => p.category))
  const kept = existing
    .filter((b) => !proposed.has(b.category))
    .map((b) => line(b.category, b.monthlyLimit, stats, "Not in the AI proposal — kept your current budget."))
  return [...proposal.map((p) => line(p.category, p.amount, stats, p.reason)), ...kept].sort(byAmountDesc)
}

export function draftTotal(lines: DraftLine[]): number {
  return lines.reduce((s, l) => s + l.amount, 0)
}

/**
 * Give `category` `pct` (0–1) of `total`, then spread what's left across the
 * other unlocked lines in proportion to their current amounts. Locked lines
 * keep their amounts; the grand total stays fixed.
 */
export function rebalance(lines: DraftLine[], category: string, pct: number, total: number): DraftLine[] {
  const lockedSum = lines.filter((l) => l.locked && l.category !== category).reduce((s, l) => s + l.amount, 0)
  const available = Math.max(0, total - lockedSum)
  const target = Math.min(Math.max(0, pct * total), available)
  const others = lines.filter((l) => !l.locked && l.category !== category)
  const othersSum = others.reduce((s, l) => s + l.amount, 0)
  const remainder = available - target
  return lines.map((l) => {
    if (l.category === category) return { ...l, amount: target }
    if (l.locked) return l
    const share = othersSum > 0 ? l.amount / othersSum : 1 / others.length
    return { ...l, amount: remainder * share }
  })
}

/** Scale unlocked lines so the draft sums to `total` (locked lines unchanged). */
export function scaleToTotal(lines: DraftLine[], total: number): DraftLine[] {
  const lockedSum = lines.filter((l) => l.locked).reduce((s, l) => s + l.amount, 0)
  const unlocked = lines.filter((l) => !l.locked)
  const unlockedSum = unlocked.reduce((s, l) => s + l.amount, 0)
  const target = Math.max(0, total - lockedSum)
  return lines.map((l) => {
    if (l.locked) return l
    const share = unlockedSum > 0 ? l.amount / unlockedSum : 1 / unlocked.length
    return { ...l, amount: target * share }
  })
}

export function updateLine(lines: DraftLine[], category: string, patch: Partial<DraftLine>): DraftLine[] {
  return lines.map((l) => (l.category === category ? { ...l, ...patch } : l))
}

export function removeLine(lines: DraftLine[], category: string): DraftLine[] {
  return lines.filter((l) => l.category !== category)
}

export function addLine(lines: DraftLine[], category: string, stats: Map<string, CategoryStats>, amount?: number): DraftLine[] {
  if (lines.some((l) => l.category === category)) return lines
  const avg = stats.get(category)?.avgMonthly ?? 0
  return [...lines, line(category, amount ?? Math.round(avg), stats)]
}

/** Saved amounts are whole dollars. */
export const saveAmount = (n: number) => Math.round(n)

export function diffDraft(existing: ExistingBudget[], lines: DraftLine[]): DraftDiff {
  const before = new Map(existing.map((b) => [b.category, b.monthlyLimit]))
  const after = new Map(lines.filter((l) => saveAmount(l.amount) > 0).map((l) => [l.category, saveAmount(l.amount)]))
  const added: DraftDiff["added"] = []
  const changed: DraftDiff["changed"] = []
  for (const [category, amount] of after) {
    const from = before.get(category)
    if (from == null) added.push({ category, amount })
    else if (Math.round(from) !== amount) changed.push({ category, from, to: amount })
  }
  const removed = existing.filter((b) => !after.has(b.category)).map((b) => ({ category: b.category, amount: b.monthlyLimit }))
  return { added, changed, removed }
}

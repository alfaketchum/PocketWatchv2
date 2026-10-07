import { FI_MILESTONE_ID } from "./plan-constants"
import { removeAccount, removeAsset, removePerson } from "./plan-edits"
import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanAdjustment, PlanDocument, PlanMilestone, Timing } from "./plan-types"

const ADJUSTMENT_LABELS: Record<PlanAdjustment["kind"], string> = {
  taxRates: "Tax rates change",
  spending: "Spending changes",
  filingStatus: "Filing status changes",
  state: "State changes",
}

export type MilestoneSource = "yours" | "kids" | "assets" | "income" | "plan"

export const MILESTONE_SOURCE_LABELS: Record<MilestoneSource, string> = {
  yours: "Yours",
  kids: "Kids",
  assets: "Assets",
  income: "Income",
  plan: "Plan",
}

export function milestoneSource(m: PlanMilestone): MilestoneSource {
  if (m.id === FI_MILESTONE_ID) return "plan"
  if (m.kind === "child") return "kids"
  if (m.kind === "asset") return "assets"
  if (m.kind === "income") return "income"
  return "yours"
}

const pointsAt = (timing: Timing, id: string) => timing.type === "milestone" && timing.milestoneId === id

/** What is tied to a milestone, e.g. ["Salary stops", "New job starts", "Tax rates change"]. */
export function milestoneUses(doc: PlanDocument, id: string): string[] {
  const uses: string[] = []
  const add = (timing: Timing, label: string) => pointsAt(timing, id) && uses.push(label)
  for (const i of doc.incomes) {
    add(i.start, `${i.name} starts`)
    if (!i.oneTime) add(i.end, `${i.name} stops`)
  }
  for (const e of doc.expenses) {
    add(e.start, `${e.name} starts`)
    if (!e.oneTime) add(e.end, `${e.name} stops`)
  }
  for (const a of doc.assets) {
    add(a.start, `${a.name} bought`)
    add(a.end, `${a.name} sold`)
  }
  for (const d of doc.debts) add(d.start, `${d.name} starts`)
  for (const m of doc.milestones) if (m.id !== id) add(m.timing, `${m.name}`)
  for (const a of doc.adjustments ?? []) add(a.timing, ADJUSTMENT_LABELS[a.kind])
  for (const d of doc.deposits ?? []) add(d.timing, `${d.name} arrives`)
  for (const c of doc.conversions ?? []) {
    add(c.start, `${c.name} starts`)
    add(c.end, `${c.name} stops`)
  }
  return uses
}

/**
 * Remove a milestone without breaking what pointed at it: those timings are pinned to the year the
 * milestone fell in (or the plan's start when it couldn't be placed).
 */
export function detachMilestone(doc: PlanDocument, id: string): PlanDocument {
  const milestone = doc.milestones.find((m) => m.id === id)
  const index = milestone ? resolveTiming(milestone.timing, timingContext(doc)) : null
  // Each item keeps its own year, offsets included ("3 years after" stays 3 years after).
  const pin = (t: Timing): Timing => ({ type: "year", year: doc.settings.startYear + Math.max(0, index ?? 0) + (t.type === "milestone" ? (t.offsetYears ?? 0) : 0) })
  const fix = (t: Timing): Timing => (pointsAt(t, id) ? pin(t) : t)
  return {
    ...doc,
    incomes: doc.incomes.map((i) => ({ ...i, start: fix(i.start), end: fix(i.end) })),
    expenses: doc.expenses.map((e) => ({ ...e, start: fix(e.start), end: fix(e.end) })),
    assets: doc.assets.map((a) => ({ ...a, start: fix(a.start), end: fix(a.end) })),
    debts: doc.debts.map((d) => ({ ...d, start: fix(d.start) })),
    adjustments: (doc.adjustments ?? []).map((a) => ({ ...a, timing: fix(a.timing) })),
    deposits: (doc.deposits ?? []).map((d) => ({ ...d, timing: fix(d.timing) })),
    conversions: (doc.conversions ?? []).map((c) => ({ ...c, start: fix(c.start), end: fix(c.end) })),
    milestones: doc.milestones.filter((m) => m.id !== id).map((m) => ({ ...m, timing: fix(m.timing) })),
  }
}

const fromMilestone = (id: string) => (item: { origin?: string }) => item.origin === id

/** Everything a template created for this milestone, e.g. ["Wedding (expense)", "Sam (person)"]. */
export function milestoneCreations(doc: PlanDocument, id: string): string[] {
  const own = fromMilestone(id)
  return [
    ...doc.incomes.filter(own).map((i) => `${i.name} (income)`),
    ...doc.expenses.filter(own).map((e) => `${e.name} (expense)`),
    ...(doc.deposits ?? []).filter(own).map((d) => (d.share === undefined ? `${d.name} (received)` : d.name)),
    ...doc.accounts.filter(own).map((a) => `${a.name} (account)`),
    ...doc.assets.filter(own).map((a) => `${a.name} (asset)`),
    ...doc.debts.filter(own).map((d) => `${d.name} (debt)`),
    ...(doc.adjustments ?? []).filter(own).map((a) => ADJUSTMENT_LABELS[a.kind]),
    ...doc.people.filter(own).map((p) => `${p.name} (person)`),
    ...doc.milestones.filter(own).map((m) => `${m.name} (milestone)`),
  ]
}

/**
 * Delete a milestone and undo what its template added: those items go away (incomes that picked up
 * from another restore its original end), then anything else still pointing at it is pinned to its year.
 */
export function removeMilestoneWithItems(doc: PlanDocument, id: string): PlanDocument {
  const own = fromMilestone(id)
  let next = doc
  for (const child of doc.milestones.filter(own)) next = removeMilestoneWithItems(next, child.id)
  const removedIncomes = next.incomes.filter(own)
  next = {
    ...next,
    incomes: next.incomes
      .filter((i) => !own(i))
      .map((i) => {
        const continuation = removedIncomes.find((r) => r.continues === i.id)
        const { endBefore, ...rest } = i
        if (continuation) return { ...(pointsAt(i.end, id) ? rest : i), end: continuation.end }
        if (endBefore && pointsAt(i.end, id)) return { ...rest, end: endBefore }
        return i
      }),
    expenses: next.expenses.filter((e) => !own(e)),
    deposits: (next.deposits ?? []).filter((d) => !own(d)),
    adjustments: (next.adjustments ?? []).filter((a) => !own(a)),
  }
  for (const asset of next.assets.filter(own)) next = removeAsset(next, asset.id)
  next = { ...next, debts: next.debts.filter((d) => !own(d)) }
  for (const account of next.accounts.filter(own)) next = removeAccount(next, account.id)
  for (const person of next.people.filter(own)) next = removePerson(next, person.id)
  return detachMilestone(next, id)
}

/**
 * Costs left behind when a purchase timed to a milestone is removed: recurring expenses that still stop at that
 * milestone (rent that ends when the home is bought), though nothing is bought there any more. Null when none.
 */
export function strandedByRemoval(doc: PlanDocument, assetId: string): { milestone: PlanMilestone; expenseIds: string[]; names: string[] } | null {
  const asset = doc.assets.find((a) => a.id === assetId)
  if (!asset || asset.start.type !== "milestone") return null
  const id = asset.start.milestoneId
  const milestone = doc.milestones.find((m) => m.id === id)
  if (!milestone || doc.assets.some((a) => a.id !== assetId && pointsAt(a.start, id))) return null
  const stranded = doc.expenses.filter((e) => !e.oneTime && pointsAt(e.end, id))
  if (stranded.length === 0) return null
  return { milestone, expenseIds: stranded.map((e) => e.id), names: stranded.map((e) => e.name) }
}

/** Those expenses run to the plan's end instead (nothing replaces them now). */
export function keepPaying(doc: PlanDocument, expenseIds: string[]): PlanDocument {
  const ids = new Set(expenseIds)
  return { ...doc, expenses: doc.expenses.map((e) => (ids.has(e.id) ? { ...e, end: { type: "planEnd" as const } } : e)) }
}

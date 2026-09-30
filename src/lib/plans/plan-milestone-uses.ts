import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanMilestone, Timing } from "./plan-types"

export type MilestoneSource = "yours" | "kids" | "assets"

export const MILESTONE_SOURCE_LABELS: Record<MilestoneSource, string> = {
  yours: "Yours",
  kids: "Kids",
  assets: "Assets",
}

export function milestoneSource(m: PlanMilestone): MilestoneSource {
  if (m.kind === "child") return "kids"
  if (m.kind === "asset") return "assets"
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
  for (const a of doc.adjustments ?? []) add(a.timing, a.kind === "taxRates" ? "Tax rates change" : "Spending changes")
  for (const d of doc.deposits ?? []) add(d.timing, `${d.name} arrives`)
  return uses
}

/**
 * Remove a milestone without breaking what pointed at it: those timings are pinned to the year the
 * milestone fell in (or the plan's start when it couldn't be placed).
 */
export function detachMilestone(doc: PlanDocument, id: string): PlanDocument {
  const milestone = doc.milestones.find((m) => m.id === id)
  const index = milestone ? resolveTiming(milestone.timing, timingContext(doc)) : null
  const pinned: Timing = { type: "year", year: doc.settings.startYear + Math.max(0, index ?? 0) }
  const fix = (t: Timing): Timing => (pointsAt(t, id) ? pinned : t)
  return {
    ...doc,
    incomes: doc.incomes.map((i) => ({ ...i, start: fix(i.start), end: fix(i.end) })),
    expenses: doc.expenses.map((e) => ({ ...e, start: fix(e.start), end: fix(e.end) })),
    assets: doc.assets.map((a) => ({ ...a, start: fix(a.start), end: fix(a.end) })),
    debts: doc.debts.map((d) => ({ ...d, start: fix(d.start) })),
    adjustments: (doc.adjustments ?? []).map((a) => ({ ...a, timing: fix(a.timing) })),
    deposits: (doc.deposits ?? []).map((d) => ({ ...d, timing: fix(d.timing) })),
    milestones: doc.milestones.filter((m) => m.id !== id).map((m) => ({ ...m, timing: fix(m.timing) })),
  }
}

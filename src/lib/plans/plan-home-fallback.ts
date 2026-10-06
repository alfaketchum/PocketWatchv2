import { typicalRunningCosts } from "./plan-asset-costs"
import { resolveRange, timingContext } from "./plan-timing"
import type { HomeSale, PlanAsset, PlanDocument, PlanExpense, YearRow } from "./plan-types"

/** A year counts as running out when this much (or more) spending goes unfunded. */
export const SHORTFALL = 0.5
/** Suffixes of what a backup plan adds (generated at simulation time, never stored). */
export const FALLBACK_RENT = "~fallback-rent"
export const FALLBACK_HOME = "~fallback-home"

/** The plan's own homes that can have a backup plan (not a later home a replacement cycle adds). */
export const fallbackHomes = (doc: PlanDocument): PlanAsset[] => doc.assets.filter((a) => a.kind === "home" && !a.replacementOf)

/** A home with a backup plan that's owned in plan year `index` (it hasn't been sold before then). */
export function fallbackHomeAt(doc: PlanDocument, index: number): PlanAsset | null {
  const ctx = timingContext(doc)
  return (
    doc.assets.find((a) => {
      if (a.kind !== "home" || !a.fallback) return false
      const range = resolveRange(a.start, a.end, ctx)
      return Math.max(0, range.start) <= index && index < range.end
    }) ?? null
  )
}

/**
 * The plan with a home's backup plan carried out in year `index`: sold at the start of that year (its loans paid off
 * from the sale), then rent from that year on or a smaller home bought with cash. The backup plan is used up.
 */
export function withHomeSold(doc: PlanDocument, home: PlanAsset, index: number): { doc: PlanDocument; sale: HomeSale } {
  const year = doc.settings.startYear + index
  const fallback = home.fallback!
  const when = { type: "year" as const, year }
  // A downsize you planned for later is replaced: drop the rent or smaller home it would have added.
  const planned = home.end.type === "milestone" ? home.end.milestoneId : null
  const kept = <T extends { origin?: string }>(items: T[]) => (planned ? items.filter((i) => i.origin !== planned) : items)
  const assets = kept(doc.assets).map((a) => (a.id === home.id ? { ...a, end: when, fallback: undefined } : a))
  const expenses = kept(doc.expenses)
  const rent: PlanExpense = {
    id: `${home.id}${FALLBACK_RENT}`,
    name: `Rent after selling ${home.name}`,
    category: "Housing",
    amount: Math.round(fallback.monthlyRent * 12),
    growth: null,
    start: when,
    end: { type: "planEnd" },
    oneTime: false,
  }
  const smaller: PlanAsset = {
    id: `${home.id}${FALLBACK_HOME}`,
    name: `Smaller home (after ${home.name})`,
    kind: "home",
    value: fallback.price,
    appreciation: home.appreciation,
    start: when,
    end: { type: "planEnd" },
    financing: { mode: "cash", downShare: 1, rate: 0, termYears: 1 },
    runningCosts: typicalRunningCosts("home", doc.settings.state),
    ...(home.primaryResidence !== undefined ? { primaryResidence: home.primaryResidence } : {}),
  }
  const next =
    fallback.then === "rent"
      ? { ...doc, assets, expenses: [...expenses, rent] }
      : { ...doc, assets: [...assets, smaller], expenses }
  return { doc: next, sale: { assetId: home.id, name: home.name, index, year, then: fallback.then } }
}

/** What your homes are worth at the end of a year, less the loans against them (that year's dollars). */
export function homeEquity(view: PlanDocument, row: YearRow): number {
  const homes = new Set(view.assets.filter((a) => a.kind === "home").map((a) => a.id))
  const value = Object.entries(row.assetValues).reduce((s, [id, v]) => s + (homes.has(id) || id.endsWith(FALLBACK_HOME) ? v : 0), 0)
  const owed = view.debts.filter((d) => d.assetId && homes.has(d.assetId)).reduce((s, d) => s + (row.debtBalances[d.id] ?? 0), 0)
  return Math.max(0, value - owed)
}

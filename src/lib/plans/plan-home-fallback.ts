import { typicalRunningCosts } from "./plan-asset-costs"
import { resolveRange, timingContext } from "./plan-timing"
import type { HomeSale, PlanAsset, PlanDocument, PlanExpense, Timing, YearRow } from "./plan-types"

/** A year counts as running out when this much (or more) spending goes unfunded. */
export const SHORTFALL = 0.5
/** Suffixes of what a backup plan adds (generated at simulation time, never stored). */
export const FALLBACK_RENT = "~fallback-rent"
export const FALLBACK_HOME = "~fallback-home"

/** The plan's own homes that can have a backup plan (not a later home a replacement cycle adds). */
export const fallbackHomes = (doc: PlanDocument): PlanAsset[] => doc.assets.filter((a) => a.kind === "home" && !a.replacementOf)

/** The plan year a home is sold in by the plan itself (a sale or downsize you entered), or null when it's kept. */
export function plannedSaleIndex(doc: PlanDocument, home: PlanAsset, ctx = timingContext(doc)): number | null {
  const { end } = resolveRange(home.start, home.end, ctx)
  return end < ctx.length ? end : null
}

/**
 * The home to sell in plan year `index`, when the money runs short then: one the plan sells later is sold now instead
 * (someone watching their accounts drain would sell sooner), or a kept home whose backup plan says to sell.
 */
export function homeToSellAt(doc: PlanDocument, index: number): { home: PlanAsset; early: boolean } | null {
  const ctx = timingContext(doc)
  for (const home of fallbackHomes(doc)) {
    const range = resolveRange(home.start, home.end, ctx)
    if (Math.max(0, range.start) > index || index >= range.end) continue
    if (plannedSaleIndex(doc, home, ctx) !== null) return { home, early: true }
    if (home.fallback) return { home, early: false }
  }
  return null
}

/**
 * The plan with a home's planned sale brought forward to year `index`: the home is sold then, and whatever its
 * downsize adds (the rent or the smaller home, tagged with its milestone) starts then too.
 */
export function withPlannedSaleEarly(doc: PlanDocument, home: PlanAsset, index: number): { doc: PlanDocument; sale: HomeSale } {
  const year = doc.settings.startYear + index
  const plannedYear = doc.settings.startYear + (plannedSaleIndex(doc, home) ?? index)
  const when = { type: "year" as const, year }
  const milestone = home.end.type === "milestone" ? home.end.milestoneId : null
  const moved = <T extends { origin?: string; start: Timing }>(items: T[]) =>
    milestone ? items.map((i) => (i.origin === milestone ? { ...i, start: when } : i)) : items
  const assets = moved(doc.assets).map((a) => (a.id === home.id ? { ...a, end: when } : a))
  return { doc: { ...doc, assets, expenses: moved(doc.expenses) }, sale: { assetId: home.id, name: home.name, index, year, then: "asPlanned", plannedYear } }
}

/**
 * The plan with a home's backup plan carried out in year `index`: sold at the start of that year (its loans paid off
 * from the sale), then rent from that year on or a smaller home bought with cash. The backup plan is used up.
 */
export function withHomeSold(doc: PlanDocument, home: PlanAsset, index: number): { doc: PlanDocument; sale: HomeSale } {
  const year = doc.settings.startYear + index
  const fallback = home.fallback!
  const when = { type: "year" as const, year }
  const assets = doc.assets.map((a) => (a.id === home.id ? { ...a, end: when, fallback: undefined } : a))
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
      ? { ...doc, assets, expenses: [...doc.expenses, rent] }
      : { ...doc, assets: [...assets, smaller] }
  return { doc: next, sale: { assetId: home.id, name: home.name, index, year, then: fallback.then } }
}

/** What your homes are worth at the end of a year, less the loans against them (that year's dollars). */
export function homeEquity(view: PlanDocument, row: YearRow): number {
  const homes = new Set(view.assets.filter((a) => a.kind === "home").map((a) => a.id))
  const value = Object.entries(row.assetValues).reduce((s, [id, v]) => s + (homes.has(id) || id.endsWith(FALLBACK_HOME) ? v : 0), 0)
  const owed = view.debts.filter((d) => d.assetId && homes.has(d.assetId)).reduce((s, d) => s + (row.debtBalances[d.id] ?? 0), 0)
  return Math.max(0, value - owed)
}

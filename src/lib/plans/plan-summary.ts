import { inflationOf } from "./plan-inflation"
import { rowInTodaysDollars } from "./plan-dollars"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanProjection, PlanSummary } from "./plan-types"
import { rowTaxes } from "./plan-row-taxes"
import { expandPlan } from "./plan-expand"
import { homeEquity } from "./plan-home-fallback"
import { isBrokeYear } from "./stress/stress-test"

/** Key numbers of a projection, in today's dollars. */
export function summarizePlan(doc: PlanDocument, projection: PlanProjection): PlanSummary {
  const { settings } = doc
  const rows = projection.rows.map((r) => rowInTodaysDollars(r, inflationOf(settings)))
  const ctx = timingContext(doc)
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const retireIndex = retirement ? resolveTiming(retirement.timing, ctx) : null
  const person = doc.people[0]
  const startAge = person ? ageAtStart(person, settings) : 0
  // Balances at the end of the year before retirement, i.e. what you retire with.
  const atRetirement =
    retireIndex === null || retireIndex < 0 || retireIndex > rows.length
      ? null
      : retireIndex === 0
        ? projection.startNetWorth
        : rows[retireIndex - 1].netWorth
  const depleted = rows.find((r) => r.shortfall > 0.5)
  const broke = depleted ? rows.slice(depleted.index).find((r) => isBrokeYear(r.netWorth, r.expenses)) : undefined
  const split = (r: (typeof rows)[number]) => ({ accounts: r.accountsTotal, property: r.netWorth - r.accountsTotal })
  const retireRow = retireIndex !== null && retireIndex > 0 && retireIndex <= rows.length ? rows[retireIndex - 1] : null
  const last = rows[rows.length - 1]
  const equity = depleted ? homeEquity(expandPlan(doc), depleted) : 0
  return {
    retirementYear: retireIndex === null ? null : settings.startYear + retireIndex,
    retirementAge: retireIndex === null ? null : startAge + retireIndex,
    netWorthAtRetirement: atRetirement,
    depletedAge: depleted ? startAge + depleted.index : null,
    depletedYear: depleted ? depleted.year : null,
    brokeAge: broke ? startAge + broke.index : null,
    brokeYear: broke ? broke.year : null,
    retirementSplit: retireRow ? split(retireRow) : null,
    endingSplit: last ? split(last) : { accounts: projection.startNetWorth, property: 0 },
    equityAtDepletion: depleted && equity > 0 ? { value: equity, years: depleted.expenses > 0 ? equity / depleted.expenses : 0 } : null,
    homeSales: (projection.homeSales ?? []).map((s) => ({ name: s.name, year: s.year, age: startAge + s.index })),
    endYear: last ? last.year : settings.startYear,
    endAge: startAge + rows.length,
    endingNetWorth: last ? last.netWorth : projection.startNetWorth,
    lifetimeTaxes: rows.reduce((s, r) => s + rowTaxes(r), 0),
    spark: rows.map((r) => r.netWorth),
    inflation: settings.inflation,
    inflationMode: settings.inflationMode ?? "custom",
  }
}

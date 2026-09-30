import { rowInTodaysDollars } from "./plan-dollars"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanProjection, PlanSummary } from "./plan-types"

/** Key numbers of a projection, in today's dollars. */
export function summarizePlan(doc: PlanDocument, projection: PlanProjection): PlanSummary {
  const { settings } = doc
  const rows = projection.rows.map((r) => rowInTodaysDollars(r, settings.inflation))
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
  const last = rows[rows.length - 1]
  return {
    retirementYear: retireIndex === null ? null : settings.startYear + retireIndex,
    retirementAge: retireIndex === null ? null : startAge + retireIndex,
    netWorthAtRetirement: atRetirement,
    depletedAge: depleted ? startAge + depleted.index : null,
    depletedYear: depleted ? depleted.year : null,
    endYear: last ? last.year : settings.startYear,
    endAge: startAge + rows.length,
    endingNetWorth: last ? last.netWorth : projection.startNetWorth,
    lifetimeTaxes: rows.reduce((s, r) => s + r.incomeTax + r.withdrawalTax, 0),
    spark: rows.map((r) => r.netWorth),
  }
}

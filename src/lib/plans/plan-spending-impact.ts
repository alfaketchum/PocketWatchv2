import { inflationOf } from "./plan-inflation"
import { simulatePlan } from "./engine/simulate"
import { deflator } from "./plan-dollars"
import { retirementAge } from "./plan-spending-patterns"
import { ageAtStart } from "./plan-timing"
import type { PlanDocument } from "./plan-types"

export interface ImpactPoint {
  age: number
  year: number
  /** Spending that year in today's dollars, with each line's pattern… */
  withPatterns: number
  /** …and with every line steady. */
  steady: number
}

export interface SpendingImpact {
  points: ImpactPoint[]
  lifetime: { withPatterns: number; steady: number }
  retireAge: number | null
}

/**
 * What the spending patterns do to recurring spending (today's dollars): the plan as is against every line
 * steady. One-time costs (a wedding, an inheritance tax) never follow a pattern, so they're left out.
 */
export function spendingImpact(doc: PlanDocument): SpendingImpact {
  const recurring = { ...doc, expenses: doc.expenses.filter((e) => !e.oneTime) }
  const steadyDoc = { ...recurring, expenses: recurring.expenses.map((e) => ({ ...e, pattern: undefined })) }
  const withRows = simulatePlan(recurring).rows
  const steadyRows = simulatePlan(steadyDoc).rows
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const real = (nominal: number, index: number) => nominal / deflator(inflationOf(doc.settings), index, "flow")
  const points = withRows.map((r, i) => ({
    age: age0 + r.index,
    year: r.year,
    withPatterns: real(r.expenses, r.index),
    steady: real(steadyRows[i]?.expenses ?? 0, r.index),
  }))
  return {
    points,
    lifetime: {
      withPatterns: points.reduce((s, p) => s + p.withPatterns, 0),
      steady: points.reduce((s, p) => s + p.steady, 0),
    },
    retireAge: retirementAge(doc),
  }
}

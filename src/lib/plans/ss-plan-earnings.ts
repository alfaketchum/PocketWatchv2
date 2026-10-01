import { incomeEntries } from "./engine/engine-flows"
import { estimatePia, type EarningsYear, type PiaEstimate } from "./ss-estimate"
import { yearlyBenefit } from "./social-security"
import { isActive, timingContext } from "./plan-timing"
import type { PlanDocument, PlanIncome } from "./plan-types"

const isWorkIncome = (i: PlanIncome) => (i.kind === "salary" || i.kind === "business") && i.taxable && !i.oneTime

/** This person's salary and business income in each plan year, in today's dollars (what Social Security counts). */
export function planEarnings(doc: PlanDocument, personId: string): EarningsYear[] {
  const ctx = timingContext(doc)
  const first = doc.people[0]?.id
  const entries = incomeEntries(doc.incomes.filter((i) => isWorkIncome(i) && (i.personId ?? first) === personId), ctx)
  const real = (growth: number | null, t: number) => (growth === null ? 1 : Math.pow((1 + growth) / (1 + doc.settings.inflation), t))
  return Array.from({ length: ctx.length }, (_, t) => ({
    year: doc.settings.startYear + t,
    amount: entries.filter((e) => isActive(e.range, t, false)).reduce((s, e) => s + e.income.amount * real(e.income.growth, t), 0),
    today: true,
  })).filter((e) => e.amount > 0)
}

/** A Social Security income's PIA estimated from its earnings record plus the plan's own earnings; null when entered. */
export function estimatedPia(doc: PlanDocument, income: PlanIncome): PiaEstimate | null {
  const ss = income.socialSecurity
  if (!ss?.earnings) return null
  const personId = income.personId ?? doc.people[0]?.id ?? ""
  const past = ss.earnings.filter(([year]) => year < doc.settings.startYear).map(([year, amount]) => ({ year, amount }))
  return estimatePia([...past, ...planEarnings(doc, personId)])
}

/** A Social Security income's own yearly benefit at its claiming age, today's dollars (estimated or entered PIA). */
export function socialSecurityYearly(doc: PlanDocument, income: PlanIncome): number {
  const ss = income.socialSecurity
  const person = doc.people.find((p) => p.id === income.personId) ?? doc.people[0]
  if (!ss || !person) return income.amount
  const estimate = estimatedPia(doc, income)
  if (estimate && estimate.eligibleYear === null) return 0
  return yearlyBenefit(estimate?.pia ?? ss.pia, person.birthYear, ss.claimAge)
}

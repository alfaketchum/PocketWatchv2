import { filingStatusAt, type AdjustmentEntry } from "../plan-adjustments"
import { priceIndex, type Inflation } from "../plan-inflation"
import { ageAtStart, isActive } from "../plan-timing"
import { claimFactor, fullRetirementAge, spousalTopUp } from "../social-security"
import type { PlanDocument, PlanIncome, PlanPerson } from "../plan-types"
import { paysWages } from "../plan-constants"
import type { IncomeEntry, IncomeYear } from "./engine-flows"

/** 2026 retirement earnings test (SSA): $1 withheld per $2 over the lower limit before the year you reach full
 * retirement age, $1 per $3 over the higher limit in that year (months before it only). Indexed to wages. */
export const EARNINGS_TEST_LIMIT = 24_480
export const EARNINGS_TEST_LIMIT_FRA_YEAR = 65_160
const MONTHS = 12

/** Months of benefits withheld so far by the earnings test, per Social Security income (credited back at FRA). */
export type WithheldMonths = Record<string, number>

interface Ctx {
  doc: PlanDocument
  entries: IncomeEntry[]
  adjustments: AdjustmentEntry[]
  index: number
  inflation: Inflation
  /** Wage index for the year (the earnings-test limits rise with it). */
  wageIndex: number
  /** Estimated from earnings records, by income id: the PIA and the first year with 40 credits (null = never). */
  estimates: Record<string, { pia: number; eligibleYear: number | null }>
}

/**
 * The PIA on this record this year: an estimate counts only from the year it has 40 credits (no benefit on
 * your own record before; spousal benefits still apply). An entered PIA is taken as earned.
 */
function piaOf(ctx: Ctx, income: PlanIncome): number {
  const estimate = ctx.estimates[income.id]
  if (!estimate) return income.socialSecurity?.pia ?? 0
  const year = ctx.doc.settings.startYear + ctx.index
  return estimate.eligibleYear !== null && year >= estimate.eligibleYear ? estimate.pia : 0
}

const personOf = (doc: PlanDocument, income: PlanIncome): PlanPerson | undefined =>
  doc.people.find((p) => p.id === income.personId) ?? doc.people[0]

/** This person's wages and self-employment income this year (nominal). */
function wagesOf(ctx: Ctx, person: PlanPerson, income: IncomeYear): number {
  return ctx.entries
    .filter((e) => (paysWages(e.income) || e.income.kind === "business") && personOf(ctx.doc, e.income)?.id === person.id)
    .reduce((s, e) => s + (income.byId[e.income.id] ?? 0), 0)
}

/** The partner's Social Security PIA when they're claiming this year and you're filing jointly. */
function partnerPia(ctx: Ctx, person: PlanPerson): number | null {
  if (ctx.doc.people.length < 2 || filingStatusAt(ctx.adjustments, ctx.doc.settings, ctx.index) !== "joint") return null
  const partner = ctx.doc.people.find((p) => p.id !== person.id)
  const claim = ctx.entries.find(
    (e) => e.income.socialSecurity && personOf(ctx.doc, e.income)?.id === partner?.id && isActive(e.range, ctx.index, false),
  )
  return claim ? piaOf(ctx, claim.income) : null
}

/** Withheld this year by the earnings test (nominal), before full retirement age only. */
function earningsTestWithheld(ctx: Ctx, person: PlanPerson, age: number, benefit: number, income: IncomeYear): number {
  const fra = fullRetirementAge(person.birthYear)
  if (age >= fra || benefit <= 0) return 0
  const wages = wagesOf(ctx, person, income)
  if (age + 1 <= fra) return Math.min(benefit, Math.max(0, (wages - EARNINGS_TEST_LIMIT * ctx.wageIndex) / 2))
  const monthsBefore = (fra - age) * MONTHS
  return Math.min((benefit * monthsBefore) / MONTHS, Math.max(0, (wages - EARNINGS_TEST_LIMIT_FRA_YEAR * ctx.wageIndex) / 3))
}

/** Scheduled share of benefits paid this year (a trust fund shortfall cuts it from a year on). */
function paidShare(doc: PlanDocument, year: number): number {
  const cut = doc.settings.ssCut
  return cut && year >= cut.fromYear ? 1 - cut.share : 1
}

/** One Social Security income this year: its benefit (with spousal top-up and any credit back), and what's withheld. */
function benefitFor(ctx: Ctx, entry: IncomeEntry, income: IncomeYear, withheld: WithheldMonths): { paid: number; withheldMonths: number } | null {
  const ss = entry.income.socialSecurity
  const person = personOf(ctx.doc, entry.income)
  if (!ss || !person || !isActive(entry.range, ctx.index, false)) return null
  const age = ageAtStart(person, ctx.doc.settings) + ctx.index
  const fra = fullRetirementAge(person.birthYear)
  // Months withheld before full retirement age are credited back from then: as if claimed that much later.
  const credited = age >= fra && ss.claimAge < fra ? Math.min(fra, ss.claimAge + (withheld[entry.income.id] ?? 0) / MONTHS) : ss.claimAge
  const pia = piaOf(ctx, entry.income)
  const own = pia * MONTHS * claimFactor(person.birthYear, credited)
  const partner = partnerPia(ctx, person)
  const spousal = partner === null ? 0 : spousalTopUp(pia, partner, person.birthYear, Math.max(ss.claimAge, age))
  const scheduled = (own + spousal) * priceIndex(ctx.inflation, ctx.index) * paidShare(ctx.doc, ctx.doc.settings.startYear + ctx.index)
  const held = earningsTestWithheld(ctx, person, age, scheduled, income)
  return { paid: scheduled - held, withheldMonths: scheduled > 0 ? (held / scheduled) * MONTHS : 0 }
}

/**
 * The year's income with Social Security worked out: incomes with claiming details get their benefit (own,
 * spousal top-up, earnings test and credit back, cost-of-living raises); any other Social Security line is
 * only cut by a trust fund shortfall. Returns the updated withheld months.
 */
export function socialSecurityYear(ctx: Ctx, income: IncomeYear, withheld: WithheldMonths): { income: IncomeYear; withheld: WithheldMonths } {
  let next = income
  let held = withheld
  for (const entry of ctx.entries) {
    if (entry.income.kind !== "social_security") continue
    const before = next.byId[entry.income.id] ?? 0
    const result = benefitFor(ctx, entry, income, held)
    const paid = result ? result.paid : before * paidShare(ctx.doc, ctx.doc.settings.startYear + ctx.index)
    if (result) held = { ...held, [entry.income.id]: (held[entry.income.id] ?? 0) + result.withheldMonths }
    if (Math.abs(paid - before) < 1e-9) continue
    const delta = paid - before
    next = {
      ...next,
      total: next.total + delta,
      byId: { ...next.byId, [entry.income.id]: paid },
      taxableIncome: next.taxableIncome + (entry.income.taxable ? delta : 0),
    }
  }
  return { income: next, withheld: held }
}

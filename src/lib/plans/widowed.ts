import { resolveTiming, timingContext, ageAtStart } from "./plan-timing"
import { SURVIVOR_EARLIEST_AGE, survivorBenefit } from "./social-security"
import type { PlanDocument, PlanIncome, PlanMilestone, PlanPerson, Timing } from "./plan-types"

type IdMaker = (prefix: string) => string

export interface WidowedInput {
  personId: string
  when: Timing
  /** Their incomes, which stop. */
  endIncomeIds: string[]
  /** Your Social Security steps up to a survivor benefit when that's larger. */
  survivorBenefit: boolean
  /** Life insurance paid out, tax-free; today's dollars. */
  lifeInsurance: number
  /** Funeral and final costs, today's dollars. */
  finalCosts: number
  /** Flat-rate plans: the new rates (filing single). */
  incomeTaxRate: number
  capitalGainsRate: number
}

const at = (milestoneId: string): Timing => ({ type: "milestone", milestoneId })
const personOf = (doc: PlanDocument, income: PlanIncome) => doc.people.find((p) => p.id === income.personId) ?? doc.people[0]

interface StepUp {
  yours: PlanIncome
  /** Survivor benefit per year, today's dollars. */
  amount: number
  /** When it starts: at the death, or at 60 if the survivor is younger. */
  start: Timing | "death"
}

/**
 * The survivor step-up: with claiming details on both benefits, SSA's survivor rules (their benefit with delay
 * credits, at least 82.5% of their PIA, reduced if taken before your full retirement age, from 60 at the
 * earliest); otherwise the larger of the two amounts. Null when your own benefit is already larger.
 */
function survivorStepUp(doc: PlanDocument, stopping: Set<string>, deceased: PlanPerson | undefined, when: Timing): StepUp | null {
  const ss = doc.incomes.filter((i) => i.kind === "social_security" && !i.oneTime)
  const theirs = ss.filter((i) => stopping.has(i.id)).sort((a, b) => b.amount - a.amount)[0]
  const remaining = ss.filter((i) => !stopping.has(i.id))
  if (!theirs || remaining.length !== 1) return null
  const yours = remaining[0]
  const survivor = personOf(doc, yours)
  const death = Math.max(0, resolveTiming(when, timingContext(doc)) ?? 0)
  if (theirs.socialSecurity && yours.socialSecurity && deceased && survivor) {
    const ageThen = ageAtStart(survivor, doc.settings) + death
    const amount = survivorBenefit({ ...theirs.socialSecurity, birthYear: deceased.birthYear }, survivor.birthYear, ageThen)
    const own = yours.amount
    if (amount <= own) return null
    return { yours, amount: Math.round(amount), start: ageThen < SURVIVOR_EARLIEST_AGE ? { type: "age", personId: survivor.id, age: SURVIVOR_EARLIEST_AGE } : "death" }
  }
  return theirs.amount > yours.amount ? { yours, amount: theirs.amount, start: "death" } : null
}

/**
 * A partner passes away: their incomes stop, your Social Security steps up to the survivor benefit when it's
 * larger, an optional tax-free life-insurance payout and final costs, and you file single from then on.
 * Accounts stay yours (spouses inherit them).
 */
export function applyWidowed(doc: PlanDocument, input: WidowedInput, icon: string, newId: IdMaker): PlanDocument {
  const person = doc.people.find((p) => p.id === input.personId)
  const msId = newId("ms-widowed")
  const when = at(msId)
  const milestone: PlanMilestone = { id: msId, name: person ? `${person.name} passes away` : "Partner passes away", kind: "custom", icon, timing: input.when }
  const stopping = new Set(input.endIncomeIds)
  const stepUp = input.survivorBenefit ? survivorStepUp(doc, stopping, person, input.when) : null
  const switchAt = stepUp && stepUp.start !== "death" ? stepUp.start : when
  const ending = new Map<string, Timing>([...[...stopping].map((id) => [id, when] as const), ...(stepUp ? [[stepUp.yours.id, switchAt] as const] : [])])
  const added: PlanIncome[] = [
    ...(stepUp
      ? [{ ...stepUp.yours, id: newId("inc"), name: "Survivor Social Security", amount: stepUp.amount, socialSecurity: undefined, start: switchAt, end: stepUp.yours.end, origin: msId, continues: stepUp.yours.id }]
      : []),
    ...(input.lifeInsurance > 0
      ? [{ id: newId("inc"), name: "Life insurance", kind: "other" as const, amount: input.lifeInsurance, growth: null, start: when, end: when, taxable: false, oneTime: true, contributions: [], origin: msId }]
      : []),
  ]
  const costs =
    input.finalCosts > 0
      ? [{ id: newId("exp"), name: "Funeral and final costs", category: null, amount: input.finalCosts, growth: null, start: when, end: when, oneTime: true, origin: msId }]
      : []
  return {
    ...doc,
    milestones: [...doc.milestones, milestone],
    incomes: [...doc.incomes.map((i) => (ending.has(i.id) ? { ...i, end: ending.get(i.id)!, endBefore: i.end } : i)), ...added.map(stripUndefined)],
    expenses: [...doc.expenses, ...costs],
    adjustments: [
      ...(doc.adjustments ?? []),
      { id: newId("adj"), kind: "filingStatus", timing: when, status: "single", origin: msId },
      { id: newId("adj"), kind: "taxRates", timing: when, incomeTaxRate: input.incomeTaxRate, capitalGainsRate: input.capitalGainsRate, origin: msId },
    ],
  }
}

/** Drops keys set to undefined (a copied income without its claiming details). */
function stripUndefined<T extends object>(item: T): T {
  return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)) as T
}

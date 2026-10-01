import { yearlyBenefit } from "./social-security"
import type { PlanDocument, PlanIncome } from "./plan-types"

type IdMaker = (prefix: string) => string

const fromAge = (personId: string, age: number) => ({ type: "age" as const, personId, age })

function addIncome(doc: PlanDocument, income: PlanIncome): PlanDocument {
  return { ...doc, incomes: [...doc.incomes, income] }
}

export interface SocialSecurityInput {
  personId: string
  /** Monthly benefit at full retirement age, today's dollars (from the SSA statement). */
  monthlyAtFra: number
  claimAge: number
}

/**
 * Social Security from the claiming age. It carries its claiming details, so the engine works out each year's
 * benefit (early/late factors, spousal top-up, earnings test); `amount` is the own benefit, for display.
 */
export function applySocialSecurity(doc: PlanDocument, input: SocialSecurityInput, newId: IdMaker): PlanDocument {
  const person = doc.people.find((p) => p.id === input.personId) ?? doc.people[0]
  if (!person) return doc
  return addIncome(doc, {
    id: newId("inc"),
    name: doc.people.length > 1 ? `Social Security (${person.name})` : "Social Security",
    kind: "social_security",
    amount: Math.round(yearlyBenefit(input.monthlyAtFra, person.birthYear, input.claimAge)),
    growth: null,
    start: fromAge(person.id, input.claimAge),
    end: { type: "planEnd" },
    taxable: true,
    oneTime: false,
    contributions: [],
    personId: person.id,
    socialSecurity: { pia: input.monthlyAtFra, claimAge: input.claimAge },
  })
}

export interface PensionInput {
  name: string
  personId: string
  /** Per year. With raises: today's dollars, rising with inflation; without: the same dollars every year. */
  amount: number
  startAge: number
  raises: boolean
}

/** A pension from an age: with raises it keeps up with inflation; without, it pays the same dollars every year. */
export function applyPension(doc: PlanDocument, input: PensionInput, newId: IdMaker): PlanDocument {
  const person = doc.people.find((p) => p.id === input.personId) ?? doc.people[0]
  if (!person) return doc
  return addIncome(doc, {
    id: newId("inc"),
    name: input.name.trim() || "Pension",
    kind: "pension",
    amount: input.amount,
    growth: input.raises ? null : 0,
    start: fromAge(person.id, input.startAge),
    end: { type: "planEnd" },
    taxable: true,
    oneTime: false,
    contributions: [],
    personId: person.id,
  })
}

import { newChild } from "./plan-children"
import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import type { PlanDebt, PlanDocument, PlanIncome, PlanMilestone, Timing } from "./plan-types"

export type TemplateKey = "retire" | "married" | "child" | "home" | "career" | "break" | "move" | "windfall" | "custom"

export interface TemplateMeta {
  key: TemplateKey
  label: string
  icon: string
  /** Where the result lives: a stored milestone, or an item that generates its own milestones. */
  creates: string
}

export const MILESTONE_TEMPLATES: TemplateMeta[] = [
  { key: "retire", label: "Retire", icon: "beach_access", creates: "Moves your retirement date" },
  { key: "married", label: "Get married", icon: "favorite", creates: "Partner, their income, new tax rates" },
  { key: "child", label: "Have a child", icon: "child_care", creates: "A child on Expenses → Kids" },
  { key: "home", label: "Buy a home", icon: "home", creates: "A home and mortgage on Assets & debts" },
  { key: "career", label: "Career change", icon: "work", creates: "Ends a salary and starts a new one" },
  { key: "break", label: "Career break", icon: "luggage", creates: "Pauses a salary for a few years" },
  { key: "move", label: "Move", icon: "moving", creates: "Changes your spending from then on" },
  { key: "windfall", label: "Windfall", icon: "redeem", creates: "A one-time income" },
  { key: "custom", label: "Custom", icon: "flag", creates: "Just a named date" },
]

const ICONS = Object.fromEntries(MILESTONE_TEMPLATES.map((t) => [t.key, t.icon])) as Record<TemplateKey, string>

type IdMaker = (prefix: string) => string

const at = (milestoneId: string): Timing => ({ type: "milestone", milestoneId })

function addMilestone(doc: PlanDocument, m: PlanMilestone): PlanDocument {
  return { ...doc, milestones: [...doc.milestones, m] }
}

export interface MarriedInput {
  when: Timing
  partner: { name: string; birthYear: number } | null
  /** Partner's salary per year from the wedding; 0 for none. */
  partnerIncome: number
  incomeTaxRate: number
  capitalGainsRate: number
  weddingCost: number
}

/** Get married: milestone, optional partner and their income, new tax rates, optional wedding cost. */
export function applyMarried(doc: PlanDocument, input: MarriedInput, newId: IdMaker): PlanDocument {
  const msId = newId("ms-married")
  let next = addMilestone(doc, { id: msId, name: "Get married", kind: "custom", icon: ICONS.married, timing: input.when })
  if (input.partner && next.people.length < 2) {
    const personId = newId("person")
    next = { ...next, people: [...next.people, { id: personId, name: input.partner.name, birthYear: input.partner.birthYear, birthMonth: 1 }] }
    if (input.partnerIncome > 0) {
      const income: PlanIncome = {
        id: newId("inc"),
        name: `${input.partner.name}'s salary`,
        kind: "salary",
        amount: input.partnerIncome,
        growth: null,
        start: at(msId),
        end: { type: "age", personId, age: 65 },
        taxable: true,
        oneTime: false,
        contributions: [],
      }
      next = { ...next, incomes: [...next.incomes, income] }
    }
  }
  next = {
    ...next,
    adjustments: [
      ...(next.adjustments ?? []),
      { id: newId("adj"), kind: "taxRates", timing: at(msId), incomeTaxRate: input.incomeTaxRate, capitalGainsRate: input.capitalGainsRate },
    ],
  }
  if (input.weddingCost > 0) {
    next = {
      ...next,
      expenses: [
        ...next.expenses,
        { id: newId("exp"), name: "Wedding", category: null, amount: input.weddingCost, growth: null, start: at(msId), end: at(msId), oneTime: true },
      ],
    }
  }
  return next
}

export function applyRetire(doc: PlanDocument, when: Timing): PlanDocument {
  return {
    ...doc,
    milestones: doc.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID || m.kind === "retirement" ? { ...m, timing: when } : m)),
  }
}

export function applyChild(doc: PlanDocument, name: string, birthYear: number, newId: IdMaker): PlanDocument {
  return { ...doc, children: [...(doc.children ?? []), newChild(newId("kid"), name, birthYear)] }
}

export interface HomeInput {
  name: string
  when: Timing
  price: number
  downPayment: number
  /** Annual mortgage rate. */
  rate: number
  termYears: number
  appreciation: number
}

/** Level monthly payment that pays `loan` off over `months` at `annualRate`. */
export function monthlyPayment(loan: number, annualRate: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0
  const r = annualRate / 12
  return r === 0 ? loan / months : (loan * r) / (1 - Math.pow(1 + r, -months))
}

/** Buy a home: the asset plus a linked mortgage; its "Buy …" milestone is generated from the asset. */
export function applyHome(doc: PlanDocument, input: HomeInput, newId: IdMaker): PlanDocument {
  const assetId = newId("asset")
  const loan = Math.max(0, input.price - input.downPayment)
  const mortgage: PlanDebt = {
    id: newId("debt"),
    name: `${input.name} mortgage`,
    kind: "mortgage",
    balance: loan,
    rate: input.rate,
    monthlyPayment: Math.round(monthlyPayment(loan, input.rate, input.termYears * 12)),
    start: input.when,
    assetId,
    source: null,
  }
  return {
    ...doc,
    assets: [...doc.assets, { id: assetId, name: input.name, kind: "home", value: input.price, appreciation: input.appreciation, start: input.when, end: { type: "planEnd" } }],
    debts: loan > 0 ? [...doc.debts, mortgage] : doc.debts,
  }
}

/** Career change: the salary stops at the milestone and a new one (same settings, new amount) starts. */
export function applyCareer(doc: PlanDocument, input: { incomeId: string; when: Timing; name: string; amount: number }, newId: IdMaker): PlanDocument {
  const old = doc.incomes.find((i) => i.id === input.incomeId)
  if (!old) return doc
  const msId = newId("ms-career")
  const next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.career, timing: input.when })
  const replacement: PlanIncome = { ...old, id: newId("inc"), name: input.name, amount: input.amount, start: at(msId), end: old.end }
  return { ...next, incomes: [...next.incomes.map((i) => (i.id === old.id ? { ...i, end: at(msId) } : i)), replacement] }
}

/** Career break: the salary stops for `years`, then resumes (same amount and settings). */
export function applyBreak(doc: PlanDocument, input: { incomeId: string; startYear: number; years: number }, newId: IdMaker): PlanDocument {
  const old = doc.incomes.find((i) => i.id === input.incomeId)
  if (!old) return doc
  const startId = newId("ms-break")
  const backId = newId("ms-back")
  let next = addMilestone(doc, { id: startId, name: "Career break", kind: "custom", icon: ICONS.break, timing: { type: "year", year: input.startYear } })
  next = addMilestone(next, { id: backId, name: "Back to work", kind: "custom", icon: ICONS.career, timing: { type: "year", year: input.startYear + input.years } })
  const resumed: PlanIncome = { ...old, id: newId("inc"), start: at(backId), end: old.end }
  return { ...next, incomes: [...next.incomes.map((i) => (i.id === old.id ? { ...i, end: at(startId) } : i)), resumed] }
}

/** Move: from the milestone on, your own spending changes by `percent`. */
export function applyMove(doc: PlanDocument, input: { name: string; when: Timing; percent: number }, newId: IdMaker): PlanDocument {
  const msId = newId("ms-move")
  const next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.move, timing: input.when })
  return { ...next, adjustments: [...(next.adjustments ?? []), { id: newId("adj"), kind: "spending", timing: at(msId), percent: input.percent }] }
}

export function applyWindfall(doc: PlanDocument, input: { name: string; when: Timing; amount: number; taxable: boolean }, newId: IdMaker): PlanDocument {
  const msId = newId("ms-windfall")
  const next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.windfall, timing: input.when })
  const income: PlanIncome = {
    id: newId("inc"),
    name: input.name,
    kind: "other",
    amount: input.amount,
    growth: null,
    start: at(msId),
    end: at(msId),
    taxable: input.taxable,
    oneTime: true,
    contributions: [],
  }
  return { ...next, incomes: [...next.incomes, income] }
}

export function applyCustom(doc: PlanDocument, input: { name: string; when: Timing }, newId: IdMaker): PlanDocument {
  return addMilestone(doc, { id: newId("ms"), name: input.name, kind: "custom", icon: ICONS.custom, timing: input.when })
}

import { newChild } from "./plan-children"
import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { resolveTiming, timingContext } from "./plan-timing"
import { stateInheritanceTax, type Relationship } from "./tax/inheritance-tax"
import type { PlanAccount, PlanDebt, PlanDocument, PlanIncome, PlanMilestone, Timing } from "./plan-types"

export type TemplateKey =
  | "retire"
  | "married"
  | "child"
  | "home"
  | "career"
  | "break"
  | "move"
  | "inheritance"
  | "windfall"
  | "custom"

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
  { key: "inheritance", label: "Inheritance", icon: "volunteer_activism", creates: "Cash, stocks, property or retirement accounts" },
  { key: "windfall", label: "Windfall", icon: "redeem", creates: "A one-time income (bonus, sale)" },
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
    next = { ...next, people: [...next.people, { id: personId, name: input.partner.name, birthYear: input.partner.birthYear, birthMonth: 1, origin: msId }] }
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
        origin: msId,
      }
      next = { ...next, incomes: [...next.incomes, income] }
    }
  }
  next = {
    ...next,
    adjustments: [
      ...(next.adjustments ?? []),
      { id: newId("adj"), kind: "taxRates", timing: at(msId), incomeTaxRate: input.incomeTaxRate, capitalGainsRate: input.capitalGainsRate, origin: msId },
      { id: newId("adj"), kind: "filingStatus", timing: at(msId), status: "joint", origin: msId },
    ],
  }
  if (input.weddingCost > 0) {
    next = {
      ...next,
      expenses: [
        ...next.expenses,
        { id: newId("exp"), name: "Wedding", category: null, amount: input.weddingCost, growth: null, start: at(msId), end: at(msId), oneTime: true, origin: msId },
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
  const replacement: PlanIncome = { ...old, id: newId("inc"), name: input.name, amount: input.amount, start: at(msId), end: old.end, origin: msId, continues: old.id }
  return { ...next, incomes: [...next.incomes.map((i) => (i.id === old.id ? { ...i, end: at(msId) } : i)), replacement] }
}

/** Career break: the salary stops for `years`, then resumes (same amount and settings). */
export function applyBreak(doc: PlanDocument, input: { incomeId: string; startYear: number; years: number }, newId: IdMaker): PlanDocument {
  const old = doc.incomes.find((i) => i.id === input.incomeId)
  if (!old) return doc
  const startId = newId("ms-break")
  const backId = newId("ms-back")
  let next = addMilestone(doc, { id: startId, name: "Career break", kind: "custom", icon: ICONS.break, timing: { type: "year", year: input.startYear } })
  next = addMilestone(next, { id: backId, name: "Back to work", kind: "custom", icon: ICONS.career, timing: { type: "year", year: input.startYear + input.years }, origin: startId })
  const resumed: PlanIncome = { ...old, id: newId("inc"), start: at(backId), end: old.end, origin: startId, continues: old.id }
  return { ...next, incomes: [...next.incomes.map((i) => (i.id === old.id ? { ...i, end: at(startId) } : i)), resumed] }
}

/** Move: from the milestone on, your own spending changes by `percent`. */
export function applyMove(doc: PlanDocument, input: { name: string; when: Timing; percent: number }, newId: IdMaker): PlanDocument {
  const msId = newId("ms-move")
  const next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.move, timing: input.when })
  return { ...next, adjustments: [...(next.adjustments ?? []), { id: newId("adj"), kind: "spending", timing: at(msId), percent: input.percent, origin: msId }] }
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
    origin: msId,
  }
  return { ...next, incomes: [...next.incomes, income] }
}

export function applyCustom(doc: PlanDocument, input: { name: string; when: Timing }, newId: IdMaker): PlanDocument {
  return addMilestone(doc, { id: newId("ms"), name: input.name, kind: "custom", icon: ICONS.custom, timing: input.when })
}

export type InheritedKind = "cash" | "stocks" | "realEstate" | "retirement"

/** One piece of an inheritance. */
export interface InheritedPart {
  kind: InheritedKind
  /** Value when received, today's dollars. */
  amount: number
  label: string
  /** Stocks: an existing taxable account, or null for a new "Inherited brokerage" account. */
  accountId: string | null
  /** Retirement accounts: Roth (tax-free withdrawals) or traditional (taxed as income). */
  roth: boolean
  /** Real estate: the year you'd sell it; null to keep it. */
  sellYear?: number | null
}

export interface InheritanceInput {
  name: string
  when: Timing
  parts: InheritedPart[]
  /** Where the person who died lived; with `relationship`, sets the state inheritance tax. */
  decedentState?: string | null
  relationship?: Relationship
  /** A flat state inheritance tax rate instead (used when no state is given). */
  stateTaxRate?: number
}

/** State inheritance tax for the whole inheritance (today's dollars). */
export function inheritanceTaxFor(input: Pick<InheritanceInput, "parts" | "decedentState" | "relationship" | "stateTaxRate">): number {
  const total = input.parts.reduce((s, p) => s + Math.max(0, p.amount), 0)
  if (input.decedentState !== undefined && input.relationship) {
    return stateInheritanceTax(input.decedentState, input.relationship, total)
  }
  return total * (input.stateTaxRate ?? 0)
}

/** Inherited IRAs must be emptied by the end of the 10th year after the death (SECURE Act). */
export const INHERITED_IRA_YEARS = 10

const newAccount = (id: string, name: string, taxTreatment: PlanAccount["taxTreatment"], returnRate: number): PlanAccount => ({
  id,
  name,
  taxTreatment,
  balance: 0,
  costBasis: null,
  returnRate,
  owner: null,
  source: null,
})

/**
 * Inheritance, by kind and taxed the way each kind is:
 * cash is not income; stocks land in a taxable account at a stepped-up basis; property is received
 * (no purchase cost) at a stepped-up basis; retirement accounts must be emptied within 10 years,
 * taxed as income unless Roth. An optional state inheritance tax is paid from cash flow.
 */
export function applyInheritance(doc: PlanDocument, input: InheritanceInput, newId: IdMaker): PlanDocument {
  const msId = newId("ms-inheritance")
  let next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.inheritance, timing: input.when })
  const when = at(msId)
  const year = doc.settings.startYear + Math.max(0, resolveTiming(input.when, timingContext(doc)) ?? 0)
  for (const part of input.parts.filter((p) => p.amount > 0)) next = addInheritedPart(next, part, msId, year, newId)
  const tax = inheritanceTaxFor(input)
  if (tax > 0) {
    next = {
      ...next,
      expenses: [
        ...next.expenses,
        { id: newId("exp"), name: "State inheritance tax", category: null, amount: tax, growth: null, start: when, end: when, oneTime: true, origin: msId },
      ],
    }
  }
  return next
}

function addInheritedPart(doc: PlanDocument, part: InheritedPart, msId: string, year: number, newId: IdMaker): PlanDocument {
  const label = part.label.trim()
  const when = at(msId)
  if (part.kind === "cash") {
    const income: PlanIncome = {
      id: newId("inc"),
      name: label || "Inherited cash",
      kind: "other",
      amount: part.amount,
      growth: null,
      start: when,
      end: when,
      taxable: false,
      oneTime: true,
      contributions: [],
      origin: msId,
    }
    return { ...doc, incomes: [...doc.incomes, income] }
  }
  if (part.kind === "realEstate") {
    return {
      ...doc,
      assets: [
        ...doc.assets,
        { id: newId("asset"), name: label || "Inherited property", kind: "home", value: part.amount, appreciation: 0.03, start: when, end: part.sellYear ? { type: "year", year: part.sellYear } : { type: "planEnd" }, acquired: "received", costBasis: null, origin: msId },
      ],
    }
  }
  const existing = part.kind === "stocks" && part.accountId ? doc.accounts.find((a) => a.id === part.accountId) : null
  const account =
    existing ??
    (part.kind === "stocks"
      ? { ...newAccount(newId("acct"), label || "Inherited brokerage", "taxable", 0.07), origin: msId }
      : {
          ...newAccount(newId("acct"), label || (part.roth ? "Inherited Roth IRA" : "Inherited IRA"), part.roth ? "roth" : "traditional", 0.07),
          drainByYear: year + INHERITED_IRA_YEARS,
          origin: msId,
        })
  const accounts = existing ? doc.accounts : [...doc.accounts, account]
  return {
    ...doc,
    accounts,
    deposits: [...(doc.deposits ?? []), { id: newId("dep"), name: label || account.name, accountId: account.id, amount: part.amount, timing: when, origin: msId }],
  }
}

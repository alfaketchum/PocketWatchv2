import { newChild } from "./plan-children"
import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { resolveTiming, timingContext } from "./plan-timing"
import { stateInheritanceTax, type Relationship } from "./tax/inheritance-tax"
import { typicalRunningCosts } from "./plan-asset-costs"
import { monthlyPayment } from "./plan-financing"
import type { AssetKind, PaymentMode, PlanAccount, PlanAdjustment, PlanDocument, PlanIncome, PlanMilestone, Timing } from "./plan-types"

export { monthlyPayment }

export type TemplateKey =
  | "retire"
  | "married"
  | "divorce"
  | "widowed"
  | "elderCare"
  | "socialSecurity"
  | "pension"
  | "child"
  | "home"
  | "vehicle"
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
  { key: "divorce", label: "Divorce", icon: "heart_broken", creates: "Splits accounts, ends their income, single filing" },
  { key: "widowed", label: "Partner passes away", icon: "local_florist", creates: "Their income stops, survivor benefit, single filing" },
  { key: "elderCare", label: "Elder care", icon: "elderly_woman", creates: "Care for a parent: who pays, and any cut to your work" },
  { key: "socialSecurity", label: "Claim Social Security", icon: "elderly", creates: "Your benefit from the age you claim (62–70)" },
  { key: "pension", label: "Pension", icon: "account_balance", creates: "A pension from an age, with or without raises" },
  { key: "child", label: "Have a child", icon: "child_care", creates: "A child on Expenses → Kids" },
  { key: "home", label: "Buy a home", icon: "home", creates: "A home and mortgage on Assets & debts" },
  { key: "vehicle", label: "Buy a vehicle", icon: "directions_car", creates: "A vehicle and its loan on Assets & debts" },
  { key: "career", label: "Career change", icon: "work", creates: "Ends a salary and starts a new one" },
  { key: "break", label: "Career break", icon: "luggage", creates: "Pauses a salary for a few years" },
  { key: "move", label: "Move", icon: "moving", creates: "Changes your spending and state taxes from then on" },
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

export interface DivorceInput {
  when: Timing
  /** Incomes that stop at the divorce (your ex's). */
  endIncomeIds: string[]
  /** Share (0–1) of each account your ex keeps; moved out untaxed. */
  exShare: number
  /** One-time legal and moving costs, today's dollars. */
  legalCost: number
  /** Alimony or child support you pay, per year in today's dollars, for `supportYears`. */
  supportPerYear: number
  supportYears: number
  /** Flat-rate plans: the new rates (filing single). */
  incomeTaxRate: number
  capitalGainsRate: number
}

/**
 * Divorce: your ex's income stops, they keep a share of every account (moved out untaxed, as transfers
 * incident to divorce are), you file single again, plus legal costs and any support you pay.
 */
export function applyDivorce(doc: PlanDocument, input: DivorceInput, newId: IdMaker): PlanDocument {
  const msId = newId("ms-divorce")
  const when = at(msId)
  let next = addMilestone(doc, { id: msId, name: "Divorce", kind: "custom", icon: ICONS.divorce, timing: input.when })
  const ending = new Set(input.endIncomeIds)
  next = { ...next, incomes: next.incomes.map((i) => (ending.has(i.id) ? { ...i, end: when, endBefore: i.end } : i)) }
  if (input.exShare > 0) {
    const splits = next.accounts
      .filter((a) => a.taxTreatment !== "education")
      .map((a) => ({ id: newId("dep"), name: `Divorce split: ${a.name}`, accountId: a.id, amount: 0, share: input.exShare, timing: when, origin: msId }))
    next = { ...next, deposits: [...(next.deposits ?? []), ...splits] }
  }
  next = {
    ...next,
    adjustments: [
      ...(next.adjustments ?? []),
      { id: newId("adj"), kind: "filingStatus", timing: when, status: "single", origin: msId },
      { id: newId("adj"), kind: "taxRates", timing: when, incomeTaxRate: input.incomeTaxRate, capitalGainsRate: input.capitalGainsRate, origin: msId },
    ],
  }
  const divorceYear = doc.settings.startYear + Math.max(0, resolveTiming(input.when, timingContext(doc)) ?? 0)
  const costs = [
    ...(input.legalCost > 0
      ? [{ id: newId("exp"), name: "Divorce: legal and moving", category: null, amount: input.legalCost, growth: null, start: when, end: when, oneTime: true, origin: msId }]
      : []),
    ...(input.supportPerYear > 0 && input.supportYears > 0
      ? [{ id: newId("exp"), name: "Alimony / child support", category: null, amount: input.supportPerYear, growth: null, start: when, end: { type: "year" as const, year: divorceYear + input.supportYears }, oneTime: false, origin: msId }]
      : []),
  ]
  return { ...next, expenses: [...next.expenses, ...costs] }
}

export interface WidowedInput {
  personId: string
  when: Timing
  /** Their incomes, which stop. */
  endIncomeIds: string[]
  /** Your Social Security steps up to theirs when theirs was larger (the survivor benefit). */
  survivorBenefit: boolean
  /** Life insurance paid out, tax-free; today's dollars. */
  lifeInsurance: number
  /** Funeral and final costs, today's dollars. */
  finalCosts: number
  /** Flat-rate plans: the new rates (filing single). */
  incomeTaxRate: number
  capitalGainsRate: number
}

/** The larger Social Security benefit among stopped vs continuing incomes, for the survivor step-up. */
function survivorStepUp(doc: PlanDocument, stopping: Set<string>): { yours: PlanIncome; theirs: PlanIncome } | null {
  const ss = doc.incomes.filter((i) => i.kind === "social_security" && !i.oneTime)
  const theirs = ss.filter((i) => stopping.has(i.id)).sort((a, b) => b.amount - a.amount)[0]
  const yours = ss.filter((i) => !stopping.has(i.id))
  return theirs && yours.length === 1 && theirs.amount > yours[0].amount ? { yours: yours[0], theirs } : null
}

/**
 * A partner passes away: their incomes stop, your Social Security steps up to theirs if it was larger, an
 * optional tax-free life-insurance payout and final costs, and you file single from then on. Accounts stay
 * yours (spouses inherit them).
 */
export function applyWidowed(doc: PlanDocument, input: WidowedInput, newId: IdMaker): PlanDocument {
  const person = doc.people.find((p) => p.id === input.personId)
  const msId = newId("ms-widowed")
  const when = at(msId)
  const name = person ? `${person.name} passes away` : "Partner passes away"
  let next = addMilestone(doc, { id: msId, name, kind: "custom", icon: ICONS.widowed, timing: input.when })
  const stopping = new Set(input.endIncomeIds)
  const stepUp = input.survivorBenefit ? survivorStepUp(next, stopping) : null
  const ending = new Set([...stopping, ...(stepUp ? [stepUp.yours.id] : [])])
  next = { ...next, incomes: next.incomes.map((i) => (ending.has(i.id) ? { ...i, end: when, endBefore: i.end } : i)) }
  const added: PlanIncome[] = [
    ...(stepUp ? [{ ...stepUp.yours, id: newId("inc"), name: "Survivor Social Security", amount: stepUp.theirs.amount, start: when, end: stepUp.yours.end, origin: msId, continues: stepUp.yours.id }] : []),
    ...(input.lifeInsurance > 0
      ? [{ id: newId("inc"), name: "Life insurance", kind: "other" as const, amount: input.lifeInsurance, growth: null, start: when, end: when, taxable: false, oneTime: true, contributions: [], origin: msId }]
      : []),
  ]
  next = {
    ...next,
    incomes: [...next.incomes, ...added],
    adjustments: [
      ...(next.adjustments ?? []),
      { id: newId("adj"), kind: "filingStatus", timing: when, status: "single", origin: msId },
      { id: newId("adj"), kind: "taxRates", timing: when, incomeTaxRate: input.incomeTaxRate, capitalGainsRate: input.capitalGainsRate, origin: msId },
    ],
  }
  if (input.finalCosts <= 0) return next
  const cost = { id: newId("exp"), name: "Funeral and final costs", category: null, amount: input.finalCosts, growth: null, start: when, end: when, oneTime: true, origin: msId }
  return { ...next, expenses: [...next.expenses, cost] }
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

export interface PurchaseInput {
  name: string
  when: Timing
  /** Today's dollars. */
  price: number
  payWith: PaymentMode
  /** Today's dollars; used when paying with a loan. */
  downPayment: number
  /** Annual loan rate. */
  rate: number
  termYears: number
  /** Yearly value change once owned (negative for a car). */
  appreciation: number
  /** Replace it every this many years; null keeps it. */
  replaceEveryYears?: number | null
}

/** A future purchase (home, vehicle): the asset with how it's paid; its loan and "Buy …" milestone are generated. */
function applyPurchase(doc: PlanDocument, kind: AssetKind, input: PurchaseInput, newId: IdMaker): PlanDocument {
  const downShare = input.price > 0 ? Math.min(1, Math.max(0, input.downPayment / input.price)) : 0
  return {
    ...doc,
    assets: [
      ...doc.assets,
      {
        id: newId("asset"),
        name: input.name,
        kind,
        value: input.price,
        appreciation: input.appreciation,
        start: input.when,
        end: { type: "planEnd" },
        financing: { mode: input.payWith, downShare, rate: input.rate, termYears: input.termYears },
        runningCosts: typicalRunningCosts(kind, doc.settings.state),
        ...(input.replaceEveryYears ? { replaceEveryYears: input.replaceEveryYears } : {}),
      },
    ],
  }
}

export function applyHome(doc: PlanDocument, input: PurchaseInput, newId: IdMaker): PlanDocument {
  return applyPurchase(doc, "home", input, newId)
}

export function applyVehicle(doc: PlanDocument, input: PurchaseInput, newId: IdMaker): PlanDocument {
  return applyPurchase(doc, "vehicle", input, newId)
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
/** A move: spending changes by `percent`, and with `state` (null = no state tax) your state tax changes too. */
export function applyMove(
  doc: PlanDocument,
  input: { name: string; when: Timing; percent: number; state?: string | null },
  newId: IdMaker,
): PlanDocument {
  const msId = newId("ms-move")
  const next = addMilestone(doc, { id: msId, name: input.name, kind: "custom", icon: ICONS.move, timing: input.when })
  const changes: PlanAdjustment[] = [
    ...(input.percent !== 0 ? [{ id: newId("adj"), kind: "spending" as const, timing: at(msId), percent: input.percent, origin: msId }] : []),
    ...(input.state !== undefined ? [{ id: newId("adj"), kind: "state" as const, timing: at(msId), state: input.state, origin: msId }] : []),
  ]
  return { ...next, adjustments: [...(next.adjustments ?? []), ...changes] }
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
        { id: newId("asset"), name: label || "Inherited property", kind: "home", value: part.amount, appreciation: 0.03, start: when, end: part.sellYear ? { type: "year", year: part.sellYear } : { type: "planEnd" }, acquired: "received", costBasis: null, primaryResidence: false, runningCosts: typicalRunningCosts("home", doc.settings.state), origin: msId },
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

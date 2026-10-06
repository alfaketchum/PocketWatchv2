import { withSettings } from "./plan-returns"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanExpense, PlanIncome } from "./plan-types"
import { claimSocialSecurityAt } from "./stress/stress-levers"

/**
 * What-if dials: quick changes tried on a copy of a plan, never saved unless asked. Each dial left unset (or at the
 * plan's own value) leaves its part of the plan alone.
 */
export interface WhatIfEvent {
  id: string
  kind: "windfall" | "purchase"
  year: number
  /** Today's dollars. */
  amount: number
  label: string
  /** Windfalls only: taxed as income (a bonus) or not (a gift, an inheritance). */
  taxable: boolean
}

export interface WhatIf {
  retireAge?: number
  /** Recurring spending changes by this share (−0.1 = 10% less). */
  spendPct?: number
  /** Added to every non-cash account's return (0.01 = one point more). */
  returnShift?: number
  inflation?: number
  ssClaimAge?: number
  events: WhatIfEvent[]
}

export const EMPTY_WHAT_IF: WhatIf = { events: [] }

export const WHAT_IF_LIMITS = {
  retireAge: { min: 40, max: 80, step: 1 },
  spendPct: { min: -0.5, max: 0.5, step: 0.05 },
  returnShift: { min: -0.03, max: 0.03, step: 0.005 },
  inflation: { min: 0, max: 0.06, step: 0.001 },
  ssClaimAge: { min: 62, max: 70, step: 1 },
  maxEvents: 5,
  maxAmount: 100_000_000,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places

function retirementOf(doc: PlanDocument) {
  return doc.milestones.find((m) => m.kind === "retirement") ?? null
}

/** The plan's own value for each dial; null where the plan has nothing for it to move (no retirement, no Social Security). */
export function baselineOf(doc: PlanDocument): { retireAge: number | null; inflation: number; ssClaimAge: number | null } {
  const person = doc.people[0]
  const retirement = retirementOf(doc)
  const index = retirement && person ? resolveTiming(retirement.timing, timingContext(doc)) : null
  const ss = doc.incomes.find((i) => i.socialSecurity)?.socialSecurity
  return {
    retireAge: index === null || !person ? null : ageAtStart(person, doc.settings) + index,
    inflation: doc.settings.inflation,
    ssClaimAge: ss ? ss.claimAge : null,
  }
}

function withRetireAge(doc: PlanDocument, age: number | undefined): PlanDocument {
  const retirement = retirementOf(doc)
  const person = doc.people[0]
  if (age === undefined || !retirement || !person || age === baselineOf(doc).retireAge) return doc
  const timing = { type: "age" as const, personId: person.id, age }
  return { ...doc, milestones: doc.milestones.map((m) => (m.id === retirement.id ? { ...m, timing } : m)) }
}

function withSpending(doc: PlanDocument, pct: number | undefined): PlanDocument {
  if (!pct) return doc
  const scale = (e: PlanExpense) => (e.oneTime ? e : { ...e, amount: Math.round(e.amount * (1 + pct)) })
  return { ...doc, expenses: doc.expenses.map(scale) }
}

function withReturnShift(doc: PlanDocument, shift: number | undefined): PlanDocument {
  if (!shift) return doc
  return {
    ...doc,
    accounts: doc.accounts.map((a) => (a.taxTreatment === "cash" ? a : { ...a, returnRate: round(a.returnRate + shift, 6) })),
  }
}

function withInflation(doc: PlanDocument, inflation: number | undefined): PlanDocument {
  if (inflation === undefined || inflation === doc.settings.inflation) return doc
  return withSettings(doc, { inflation, inflationMode: "custom" })
}

/** Claiming moves when it starts and what it pays too, not just the claim age (the engine pays from the start). */
function withClaimAge(doc: PlanDocument, age: number | undefined): PlanDocument {
  if (age === undefined || age === baselineOf(doc).ssClaimAge) return doc
  return claimSocialSecurityAt(doc, age)
}

function eventItem(e: WhatIfEvent): { income?: PlanIncome; expense?: PlanExpense } {
  const when = { type: "year" as const, year: e.year }
  const base = { id: `whatif-${e.id}`, name: e.label, amount: e.amount, growth: null, start: when, end: when, oneTime: true }
  if (e.kind === "purchase") return { expense: { ...base, category: null } }
  return { income: { ...base, kind: "other", taxable: e.taxable, contributions: [] } }
}

function withEvents(doc: PlanDocument, events: WhatIfEvent[]): PlanDocument {
  const items = events.filter((e) => e.amount > 0).map(eventItem)
  if (items.length === 0) return doc
  return {
    ...doc,
    incomes: [...doc.incomes, ...items.flatMap((i) => (i.income ? [i.income] : []))],
    expenses: [...doc.expenses, ...items.flatMap((i) => (i.expense ? [i.expense] : []))],
  }
}

/** The plan with every dial applied. Inflation goes first, so a real-basis plan's returns move before the shift. */
export function applyWhatIf(doc: PlanDocument, w: WhatIf): PlanDocument {
  const steps = [
    (d: PlanDocument) => withInflation(d, w.inflation),
    (d: PlanDocument) => withRetireAge(d, w.retireAge),
    (d: PlanDocument) => withSpending(d, w.spendPct),
    (d: PlanDocument) => withReturnShift(d, w.returnShift),
    (d: PlanDocument) => withClaimAge(d, w.ssClaimAge),
    (d: PlanDocument) => withEvents(d, w.events),
  ]
  return steps.reduce((d, step) => step(d), doc)
}

/** Whether any dial is moved. */
export function isWhatIfEmpty(w: WhatIf): boolean {
  return (
    w.retireAge === undefined &&
    !w.spendPct &&
    !w.returnShift &&
    w.inflation === undefined &&
    w.ssClaimAge === undefined &&
    w.events.length === 0
  )
}

const EVENT_SEP = "~"

/** The dials as URL query params (only the ones moved). */
export function whatIfToQuery(w: WhatIf): URLSearchParams {
  const q = new URLSearchParams()
  if (w.retireAge !== undefined) q.set("retire", String(w.retireAge))
  if (w.spendPct) q.set("spend", String(Math.round(w.spendPct * 100)))
  if (w.returnShift) q.set("ret", String(round(w.returnShift * 100, 2)))
  if (w.inflation !== undefined) q.set("infl", String(round(w.inflation * 100, 2)))
  if (w.ssClaimAge !== undefined) q.set("ss", String(w.ssClaimAge))
  for (const e of w.events) q.append("ev", [e.kind[0], e.year, e.amount, e.taxable ? 1 : 0, e.label].join(EVENT_SEP))
  return q
}

function num(q: URLSearchParams, key: string): number | undefined {
  const raw = q.get(key)
  const v = raw === null ? NaN : Number(raw)
  return Number.isFinite(v) ? v : undefined
}

function parseEvent(raw: string, i: number): WhatIfEvent | null {
  const [k, year, amount, taxable, ...label] = raw.split(EVENT_SEP)
  const y = Number(year)
  const a = Number(amount)
  if ((k !== "w" && k !== "p") || !Number.isInteger(y) || !Number.isFinite(a) || a <= 0) return null
  const kind = k === "w" ? "windfall" : "purchase"
  return {
    id: `ev${i}`,
    kind,
    year: y,
    amount: Math.min(a, WHAT_IF_LIMITS.maxAmount),
    taxable: taxable === "1",
    label: label.join(EVENT_SEP) || (kind === "windfall" ? "Windfall" : "Purchase"),
  }
}

/** Dials read back from the URL, clamped to their ranges; anything unreadable is dropped. */
export function whatIfFromQuery(q: URLSearchParams): WhatIf {
  const L = WHAT_IF_LIMITS
  const pct = (key: string) => {
    const v = num(q, key)
    return v === undefined ? undefined : v / 100
  }
  const retire = num(q, "retire")
  const spend = pct("spend")
  const ret = pct("ret")
  const infl = pct("infl")
  const ss = num(q, "ss")
  const events = q.getAll("ev").map(parseEvent).filter((e): e is WhatIfEvent => e !== null).slice(0, L.maxEvents)
  return {
    retireAge: retire === undefined ? undefined : clamp(Math.round(retire), L.retireAge.min, L.retireAge.max),
    spendPct: spend === undefined ? undefined : clamp(spend, L.spendPct.min, L.spendPct.max),
    returnShift: ret === undefined ? undefined : clamp(ret, L.returnShift.min, L.returnShift.max),
    inflation: infl === undefined ? undefined : clamp(infl, L.inflation.min, L.inflation.max),
    ssClaimAge: ss === undefined ? undefined : clamp(Math.round(ss), L.ssClaimAge.min, L.ssClaimAge.max),
    events,
  }
}

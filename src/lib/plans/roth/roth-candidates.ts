/**
 * Roth conversion strategies the optimizer tries: fill a bracket (with and without the IRMAA cap), a fixed amount,
 * or convert everything by an age, each over a few start/end windows. One rule per person with their own
 * traditional money, the same strategy for each.
 */
import { timingLabel } from "@/components/plans/plans-helpers"
import { RETIREMENT_MILESTONE_ID, ROTH_OPTIMIZER_ORIGIN } from "../plan-constants"
import { conversionDestinations, conversionModeLabel, conversionSources } from "../plan-conversions"
import { resolveRange, timingContext } from "../plan-timing"
import type { ConversionCaps, ConversionMode, PlanAccount, PlanConversion, PlanDocument, PlanPerson, Timing } from "../plan-types"
import { rmdStartAge } from "../tax/retirement-rules-2026"

export const OPTIMIZER_BRACKETS = [0.12, 0.22, 0.24, 0.32, 0.35] as const
const FIXED_AMOUNTS = [10_000, 25_000, 50_000, 75_000, 100_000]
const CONVERT_ALL_AGES = [65, 70, 73, 75]
const LATE_END_AGE = 75
const START_DELAY_YEARS = 3

/** The same strategy for each person; `mode` and `caps` are shared, accounts and timing per person. */
export interface RothStrategy {
  mode: ConversionMode
  caps: ConversionCaps
  start: (p: PlanPerson) => Timing
  end: (p: PlanPerson) => Timing
}

export interface RothCandidate {
  /** Stable key for de-duplication. */
  id: string
  label: string
  rules: PlanConversion[]
  /** Roth accounts the candidate opens for people who have none. */
  newAccounts: PlanAccount[]
}

interface Window {
  start: (p: PlanPerson) => Timing
  end: (p: PlanPerson) => Timing
}

function starts(doc: PlanDocument): ((p: PlanPerson) => Timing)[] {
  const out: ((p: PlanPerson) => Timing)[] = [() => ({ type: "planStart" })]
  if (doc.milestones.some((m) => m.id === RETIREMENT_MILESTONE_ID)) {
    out.push(() => ({ type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID }))
    out.push(() => ({ type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID, offsetYears: START_DELAY_YEARS }))
  }
  return out
}

function ends(doc: PlanDocument): ((p: PlanPerson) => Timing)[] {
  const claim = (p: PlanPerson) => doc.incomes.find((i) => i.kind === "social_security" && (i.personId ?? doc.people[0]?.id) === p.id)
  return [
    (p) => claim(p)?.start ?? { type: "planEnd" },
    (p) => ({ type: "age", personId: p.id, age: rmdStartAge(p.birthYear) }),
    (p) => ({ type: "age", personId: p.id, age: LATE_END_AGE }),
    () => ({ type: "planEnd" }),
  ]
}

/** Start/end windows that resolve to at least one year, de-duplicated by the years they cover (first person). */
export function strategyWindows(doc: PlanDocument): Window[] {
  const person = doc.people[0]
  if (!person) return []
  const ctx = timingContext(doc)
  const seen = new Set<string>()
  const out: Window[] = []
  for (const start of starts(doc)) {
    for (const end of ends(doc)) {
      const r = resolveRange(start(person), end(person), ctx)
      const key = `${Math.max(0, r.start)}-${Math.min(ctx.length, r.end)}`
      if (Math.min(ctx.length, r.end) <= Math.max(0, r.start) || seen.has(key)) continue
      seen.add(key)
      out.push({ start, end })
    }
  }
  return out
}

function rothFor(doc: PlanDocument, person: PlanPerson, source: PlanAccount): { dest: PlanAccount; opened: PlanAccount | null } {
  const existing = conversionDestinations(doc, person)[0]
  if (existing) return { dest: existing, opened: null }
  const opened: PlanAccount = {
    id: `roth-${person.id}`, name: `Roth IRA (${person.name})`, taxTreatment: "roth", balance: 0, costBasis: null,
    returnRate: source.returnRate, owner: person.id, source: null, origin: ROTH_OPTIMIZER_ORIGIN,
  }
  return { dest: opened, opened }
}

/** The strategy as rules for each person with their own traditional accounts. */
export function strategyCandidate(doc: PlanDocument, s: RothStrategy): RothCandidate | null {
  const people = doc.people.filter((p) => conversionSources(doc, p).length > 0)
  if (people.length === 0) return null
  const newAccounts: PlanAccount[] = []
  const rules = people.map((p, i): PlanConversion => {
    const sources = conversionSources(doc, p)
    const { dest, opened } = rothFor(doc, p, sources[0])
    if (opened) newAccounts.push(opened)
    return {
      id: `roth-opt-${i + 1}`, name: `Roth conversion (${p.name})`, start: s.start(p), end: s.end(p),
      sourceAccountIds: sources.map((a) => a.id), destAccountId: dest.id, caps: s.caps, payTaxFrom: "cashFlow",
      origin: ROTH_OPTIMIZER_ORIGIN, ...s.mode,
    }
  })
  const first = rules[0]
  const cap = s.caps.irmaaTier != null ? " · IRMAA tier 0" : ""
  const label = `${conversionModeLabel(s.mode)}${cap} · ${timingLabel(first.start, doc)} → ${timingLabel(first.end, doc)}`
  return { id: JSON.stringify(rules.map(({ id, name, ...r }) => r)), label, rules, newAccounts }
}

/** Every strategy to try for this plan. */
export function rothStrategies(doc: PlanDocument): RothStrategy[] {
  const windows = strategyWindows(doc)
  const out: RothStrategy[] = []
  for (const w of windows) {
    for (const bracketRate of OPTIMIZER_BRACKETS) {
      out.push({ ...w, mode: { mode: "bracket", bracketRate }, caps: {} })
      out.push({ ...w, mode: { mode: "bracket", bracketRate }, caps: { irmaaTier: 0 } })
    }
    for (const amount of FIXED_AMOUNTS) out.push({ ...w, mode: { mode: "fixed", amount, amountBasis: "today" }, caps: {} })
  }
  for (const start of starts(doc)) {
    for (const age of CONVERT_ALL_AGES) out.push({ start, end: (p) => ({ type: "age", personId: p.id, age }), mode: { mode: "convertAll" }, caps: {} })
  }
  return out
}

/** Nearby strategies for refining a good one: the next bracket either way, ending 2 years sooner or later, ±25%. */
export function nearby(s: RothStrategy): RothStrategy[] {
  const out: RothStrategy[] = []
  const m = s.mode
  if (m.mode === "bracket") {
    const i = OPTIMIZER_BRACKETS.indexOf(m.bracketRate as (typeof OPTIMIZER_BRACKETS)[number])
    for (const j of [i - 1, i + 1]) if (OPTIMIZER_BRACKETS[j]) out.push({ ...s, mode: { mode: "bracket", bracketRate: OPTIMIZER_BRACKETS[j] } })
  }
  if (m.mode === "fixed") for (const f of [0.75, 1.25]) out.push({ ...s, mode: { ...m, amount: Math.round(m.amount * f) } })
  for (const shift of [-2, 2]) {
    out.push({
      ...s,
      end: (p) => {
        const t = s.end(p)
        if (t.type === "age") return { ...t, age: t.age + shift }
        if (t.type === "milestone") return { ...t, offsetYears: Math.max(0, (t.offsetYears ?? 0) + shift) }
        return t
      },
    })
  }
  return out
}

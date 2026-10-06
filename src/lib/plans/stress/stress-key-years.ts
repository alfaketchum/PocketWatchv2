/**
 * Key years: the plan's big moments in one short table, from its steady projection. Only years where something
 * happens (a job starts or ends, a purchase, a child, a move, retirement, money arriving, the money running out),
 * each with household pay, what goes out, the accounts and net worth that year, in today's dollars.
 */

import { deflator } from "../plan-dollars"
import { expandPlan } from "../plan-expand"
import { SHORTFALL } from "../plan-home-fallback"
import { inflationOf } from "../plan-inflation"
import { ageAtStart, resolveRange, resolveTiming, timingContext } from "../plan-timing"
import type { PlanDocument, PlanProjection, YearRow } from "../plan-types"
import { futurePurchases } from "./stress-levers"

export interface KeyYearEvent {
  text: string
  /** "bad" for the money running out; everything else is plain. */
  tone?: "bad"
}

export interface KeyYear {
  index: number
  year: number
  age: number
  /** Today's dollars: household pay (salaries, business, stock pay), what goes out (spending and loan payments),
   *  money in accounts and net worth at the year's end. */
  pay: number
  out: number
  accounts: number
  netWorth: number
  events: KeyYearEvent[]
}

/** Rows shown at most (the first and last always among them). */
const MAX_ROWS = 14
const EARNED = new Set(["salary", "business", "equity"])

const k = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`)

type Add = (index: number | null, text: string, tone?: KeyYearEvent["tone"]) => void

/** Milestones the plan names (marriage, a move, retirement…), skipping the ones generated for children. */
function milestoneEvents(doc: PlanDocument, add: Add) {
  const ctx = timingContext(doc)
  for (const m of doc.milestones) if (m.kind !== "child") add(resolveTiming(m.timing, ctx), m.name)
}

/** Purchases still ahead with their down payment, and sales. */
function assetEvents(doc: PlanDocument, rows: YearRow[], today: (v: number, i: number) => number, add: Add) {
  const ctx = timingContext(doc)
  for (const a of futurePurchases(doc)) {
    const i = resolveTiming(a.start, ctx)
    const down = i === null ? 0 : (rows[i]?.assetPurchases ?? 0)
    add(i, down > 0 ? `Buys ${a.name}: ${k(today(down, i!))} down` : `Buys ${a.name}`)
  }
  for (const a of doc.assets) {
    const { start, end } = resolveRange(a.start, a.end, ctx)
    if (end < rows.length && end > Math.max(0, start) && !a.replacementOf) add(end, `Sells ${a.name}`)
  }
}

/** Jobs that start or end mid-plan, one-time money, loans taken later, children and college. */
function lifeEvents(doc: PlanDocument, rows: YearRow[], today: (v: number, i: number) => number, add: Add) {
  const ctx = timingContext(doc)
  for (const inc of doc.incomes) {
    const { start, end } = resolveRange(inc.start, inc.end, ctx)
    if (inc.oneTime) {
      add(start, `${inc.name}: +${k(today(rows[start]?.incomeBy[inc.id] ?? 0, start))}`)
      continue
    }
    // Pay timed to a milestone (a career change, retirement) is already named by that milestone.
    if (!EARNED.has(inc.kind)) continue
    if (start > 0 && inc.start.type !== "milestone") add(start, `${inc.name} starts`)
    if (end < rows.length && inc.end.type !== "milestone") add(end, `${inc.name} ends`)
  }
  for (const d of expandPlan(doc).debts.filter((x) => !x.assetId)) {
    const i = resolveTiming(d.start, ctx)
    if (i !== null && i > 0) add(i, `${d.name}: ${k(d.balance)} borrowed`)
  }
  for (const d of doc.deposits ?? []) add(resolveTiming(d.timing, ctx), `${d.name}: +${k(d.amount)}`)
  for (const c of doc.children) {
    add(c.birthYear - doc.settings.startYear, `${c.name} born`)
    if (c.college.enabled) add(c.birthYear + c.college.startAge - doc.settings.startYear, `${c.name} starts college`)
  }
}

/**
 * The plan's key years, earliest first. `runOutAge` (the stress test's typical run-out age) adds a marker row; the
 * steady projection's own first short year is always marked.
 */
export function keyYears(doc: PlanDocument, projection: PlanProjection, runOutAge: number | null = null): KeyYear[] {
  const rows = projection.rows
  const person = doc.people[0]
  if (rows.length === 0 || !person) return []
  const age0 = ageAtStart(person, doc.settings)
  const inflation = inflationOf(doc.settings)
  const today = (v: number, i: number) => v / deflator(inflation, i, "flow")
  const events = new Map<number, KeyYearEvent[]>()
  const add: Add = (i, text, tone) => {
    if (i === null || i < 0 || i >= rows.length) return
    const list = events.get(i) ?? []
    if (!list.some((e) => e.text === text)) events.set(i, [...list, { text, ...(tone ? { tone } : {}) }])
  }
  add(0, "Today")
  milestoneEvents(doc, add)
  assetEvents(doc, rows, today, add)
  lifeEvents(doc, rows, today, add)
  const short = rows.findIndex((r) => r.shortfall > SHORTFALL)
  if (short >= 0) add(short, "Money runs out (steady returns)", "bad")
  if (runOutAge !== null) add(runOutAge - age0, "Typical stress trial runs out", "bad")
  add(rows.length - 1, "Plan ends")
  // Over the limit: today, the end and the money running out always stay, then the earliest of the rest.
  const all = [...events.keys()].sort((a, b) => a - b)
  const must = all.filter((i) => i === 0 || i === rows.length - 1 || events.get(i)!.some((e) => e.tone === "bad"))
  const rest = all.filter((i) => !must.includes(i)).slice(0, Math.max(0, MAX_ROWS - must.length))
  const keep = [...must, ...rest].sort((a, b) => a - b)
  const earned = doc.incomes.filter((i) => EARNED.has(i.kind)).map((i) => i.id)
  return keep.map((i) => {
    const r = rows[i]
    const balance = deflator(inflation, i, "balance")
    return {
      index: i,
      year: r.year,
      age: age0 + i,
      pay: today(earned.reduce((s, id) => s + (r.incomeBy[id] ?? 0), 0), i),
      out: today(r.expenses + r.debtPayments, i),
      accounts: r.accountsTotal / balance,
      netWorth: r.netWorth / balance,
      events: events.get(i) ?? [],
    }
  })
}

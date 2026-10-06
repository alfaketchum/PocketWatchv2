/**
 * "Why it fails": the failed trials explained in plain words, from the plan itself and its steady projection. Each
 * insight is a pattern that commonly sinks a plan (when it runs out, what the money goes to then, what it's invested
 * in, money that arrives too late, wealth that can't pay bills, rosy assumptions, taxes), shown only when it applies.
 */

import { expensesView } from "../plan-chart-detail"
import { deflator, realRate } from "../plan-dollars"
import { expandPlan } from "../plan-expand"
import { inflationOf } from "../plan-inflation"
import { ageAtStart, resolveTiming, timingContext } from "../plan-timing"
import type { PlanDocument, PlanProjection, YearRow } from "../plan-types"
import type { AnnualHistory } from "./stress-history"
import { isInvested, portfolioMix } from "./stress-levers"
import { CRYPTO_BETA, mixFor } from "./stress-mix"
import { percentile, type CohortResult } from "./stress-test"

export type InsightKey = "when" | "crunch" | "noPaycheck" | "riskyMix" | "lowRisk" | "lateMoney" | "illiquid" | "optimism" | "taxDrag"
/** What an insight's "See fix" points at: a solver (or What would help row) that pulls the matching lever. */
export type InsightFix = "spending" | "mix" | "retirement" | "socialSecurity" | "sell-homes"

export interface Insight {
  key: InsightKey
  title: string
  detail: string
  fix?: InsightFix
}

/** Crypto at or past this share of invested money is called out. */
const CRYPTO_SHARE = 0.2
/** One account holding this much of everything is concentrated. */
const ONE_ACCOUNT_SHARE = 0.7
/** Mostly cash and bonds past this share, over a long plan, is too timid. */
const LOW_RISK_SHARE = 0.7
const LOW_RISK_YEARS = 25
/** Taxes this big a share of what leaves the accounts are worth naming. */
const TAX_DRAG = 0.2
/** Spending lines whose rise is shown, biggest first. */
const TOP_RISES = 3

const k = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`)
const pct = (v: number) => `${Math.round(v * 100)}%`

interface Context {
  doc: PlanDocument
  rows: YearRow[]
  age0: number
  /** Failed trials' run-out ages, sorted. */
  ages: number[]
  /** The typical (median) run-out age and its plan year. */
  age: number
  index: number
  /** Today's dollars of a flow in plan year `i`. */
  today: (v: number, i: number) => number
  spending: number
}

function when(c: Context, total: number): Insight {
  const [p10, p90] = [percentile(c.ages, 0.1), percentile(c.ages, 0.9)].map(Math.round)
  return {
    key: "when",
    title: `${pct(c.ages.length / total)} of trials run out, typically at ${c.age}`,
    detail: p10 === p90 ? `All of them at about ${c.age}.` : `Most between ${p10} and ${p90}.`,
  }
}

/** Spending at the typical run-out age vs today (today's dollars), and the lines that grew most. */
function crunch(c: Context): Insight | null {
  const view = expensesView(expandPlan(c.doc), c.rows, true)
  const at = view.points[c.index]
  const now = view.points[0]
  if (!at || !now) return null
  const then = c.today(at.spent ?? 0, c.index)
  const first = c.today(now.spent ?? 0, 0)
  if (then <= first * 1.15) return null
  // A loan's principal and interest are one payment here.
  const byLine = new Map<string, number>()
  for (const s of view.series) {
    const label = s.label.replace(/ · (principal|interest)$/, "")
    byLine.set(label, (byLine.get(label) ?? 0) + c.today(at[s.key] ?? 0, c.index) - c.today(now[s.key] ?? 0, 0))
  }
  const rises = [...byLine]
    .map(([label, rise]) => ({ label, rise }))
    .filter((s) => s.rise >= 1_000)
    .sort((a, b) => b.rise - a.rise)
    .slice(0, TOP_RISES)
  return {
    key: "crunch",
    title: `Spending climbs to ${k(then)} a year by ${c.age} (now ${k(first)})`,
    detail: `${rises.map((r) => `${r.label} +${k(r.rise)}`).join(", ")}, in today's dollars.`,
    fix: "spending",
  }
}

function noPaycheck(c: Context): Insight | null {
  const earned = c.doc.incomes.filter((i) => (i.kind === "salary" || i.kind === "business" || i.kind === "equity") && i.amount > 0)
  const paid = c.rows.slice(0, c.index + 1).some((r) => earned.some((i) => (r.incomeBy[i.id] ?? 0) > 0))
  if (paid) return null
  return { key: "noPaycheck", title: "No paycheck: every bill comes out of your accounts", detail: `From ${c.age0} on, selling investments pays for everything, so a bad market early hurts most.` }
}

/** What the money is invested in: too much in one swingy place, or too little in growth. */
function mixInsights(c: Context): Insight[] {
  const mix = portfolioMix(c.doc)
  if (!mix) return []
  const out: Insight[] = []
  if (mix.crypto >= CRYPTO_SHARE) {
    out.push({ key: "riskyMix", title: `${pct(mix.crypto)} of your investments are crypto`, detail: `The stress test swings crypto ${CRYPTO_BETA}× as hard as stocks, so a crash while you're selling does lasting damage.`, fix: "mix" })
  } else {
    const invested = c.doc.accounts.filter((a) => isInvested(a) && a.balance > 0)
    const total = invested.reduce((s, a) => s + a.balance, 0)
    const top = invested.reduce((m, a) => (a.balance > m.balance ? a : m), invested[0])
    if (top && total > 0 && top.balance / total >= ONE_ACCOUNT_SHARE && invested.length > 1) {
      out.push({ key: "riskyMix", title: `${pct(top.balance / total)} of your investments are in ${top.name}`, detail: "One account carries the whole plan; its swings are your plan's swings.", fix: "mix" })
    }
  }
  if (mix.cash + mix.bonds >= LOW_RISK_SHARE && c.rows.length >= LOW_RISK_YEARS) {
    out.push({ key: "lowRisk", title: `${pct(mix.cash + mix.bonds)} in cash and bonds`, detail: "Over a plan this long, they barely beat inflation; some stocks usually help.", fix: "mix" })
  }
  return out
}

/** Money that only arrives after the typical run-out age: inheritances, one-time income, rent, Social Security. */
function lateMoney(c: Context): Insight | null {
  const expanded = expandPlan(c.doc)
  const ctx = timingContext(c.doc)
  const late: { name: string; age: number; value: number }[] = []
  const firstPaid = (by: (r: YearRow) => number) => c.rows.findIndex((r) => by(r) > 0)
  for (const inc of expanded.incomes) {
    const i = firstPaid((r) => r.incomeBy[inc.id] ?? 0)
    if (i > c.index) late.push({ name: inc.name, age: c.age0 + i, value: c.today(c.rows[i].incomeBy[inc.id] ?? 0, i) })
  }
  for (const d of c.doc.deposits ?? []) {
    const i = resolveTiming(d.timing, ctx)
    if (i !== null && i > c.index && d.amount > 0) late.push({ name: d.name, age: c.age0 + i, value: d.amount })
  }
  for (const a of c.doc.assets.filter((x) => x.acquired === "received")) {
    const i = resolveTiming(a.start, ctx)
    if (i !== null && i > c.index) late.push({ name: a.name, age: c.age0 + i, value: a.value })
  }
  const big = late.filter((l) => l.value >= c.spending * 0.25).sort((a, b) => b.value - a.value).slice(0, TOP_RISES)
  if (big.length === 0) return null
  return {
    key: "lateMoney",
    title: `Money that arrives after ${c.age} can't help`,
    detail: `${big.map((l) => `${l.name} (${k(l.value)}) at ${l.age}`).join(", ")}: most failures happen first.`,
  }
}

/** Failed trials that still owned a lot when the money ran out: rich on paper, nothing to spend. */
function illiquid(c: Context, failed: CohortResult[]): Insight | null {
  const equity = percentile(failed.map((f) => f.equityAtDepletion ?? 0), 0.5)
  if (equity < c.spending) return null
  return {
    key: "illiquid",
    title: `Typically ${k(equity)} of property left when the money runs out`,
    detail: "Homes and property only pay the bills if they're sold or rented.",
    fix: "sell-homes",
  }
}

/** The steady plan looks fine; replayed markets don't. */
function optimism(c: Context, annual: AnnualHistory | null): Insight | null {
  if (c.rows.some((r) => r.shortfall > 0.5)) return null
  const inflation = c.doc.settings.inflation
  const invested = c.doc.accounts.filter((a) => isInvested(a) && a.balance > 0)
  const total = invested.reduce((s, a) => s + a.balance, 0)
  if (total <= 0) return null
  const assumed = invested.reduce((s, a) => s + a.balance * realRate(a.returnRate, inflation), 0) / total
  const stock = annual ? Math.exp(annual.stockLogMean) - 1 : null
  const mix = portfolioMix(c.doc)
  const crypto = mix ? invested.reduce((s, a) => s + a.balance * mixFor(a).crypto * realRate(a.returnRate, inflation), 0) / total : 0
  const history = stock !== null && mix ? mix.stocks * stock + crypto : null
  return {
    key: "optimism",
    title: "Your plan's steady line never runs out; real markets do",
    detail:
      history !== null && assumed > history + 0.005
        ? `It assumes ${pct(assumed)} a year after inflation, every year. History averages less for this mix and comes in booms and crashes.`
        : `It assumes ${pct(assumed)} a year after inflation, every year; the stress test replays history's booms and crashes instead.`,
  }
}

function taxDrag(c: Context): Insight | null {
  const r = c.rows[c.index]
  if (!r || r.withdrawals <= 0) return null
  const share = r.incomeTax / (r.withdrawals + r.income)
  if (share < TAX_DRAG) return null
  return { key: "taxDrag", title: `Taxes take ${pct(share)} of what you live on by ${c.age}`, detail: `About ${k(c.today(r.incomeTax, c.index))} a year in today's dollars, mostly on investments you sell.` }
}

/**
 * The failed trials explained, most telling first (empty when nothing ran out). `rows` are the plan's steady
 * projection; ages and dollars are read at the typical run-out age.
 */
export function diagnose(doc: PlanDocument, projection: PlanProjection, cohorts: CohortResult[], annual: AnnualHistory | null): Insight[] {
  const failed = cohorts.filter((c) => c.depletedAge !== null)
  const person = doc.people[0]
  if (failed.length === 0 || !person) return []
  const rows = projection.rows
  const age0 = ageAtStart(person, doc.settings)
  const ages = failed.map((f) => f.depletedAge!).sort((a, b) => a - b)
  const age = Math.round(percentile(ages, 0.5))
  const index = Math.min(rows.length - 1, Math.max(0, age - age0))
  const inflation = inflationOf(doc.settings)
  const today = (v: number, i: number) => v / deflator(inflation, i, "flow")
  const spending = today(rows[index]?.expenses ?? 0, index)
  const c: Context = { doc, rows, age0, ages, age, index, today, spending }
  const found = [when(c, cohorts.length), crunch(c), ...mixInsights(c), noPaycheck(c), lateMoney(c), illiquid(c, failed), optimism(c, annual), taxDrag(c)]
  return found.filter((i): i is Insight => i !== null)
}

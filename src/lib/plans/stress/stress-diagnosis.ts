/**
 * "Why it fails": the failed trials explained in plain words, from the plan itself and its steady projection. Each
 * insight is a pattern that commonly sinks a plan (when it runs out, what the money goes to then, what it's invested
 * in, money that arrives too late, wealth that can't pay bills, rosy assumptions, taxes), shown only when it applies.
 */

import { expensesView } from "../plan-chart-detail"
import { deflator, realRate } from "../plan-dollars"
import { expandPlan } from "../plan-expand"
import { inflationOf } from "../plan-inflation"
import { rowTaxes } from "../plan-row-taxes"
import { ageAtStart, resolveRange, resolveTiming, timingContext } from "../plan-timing"
import type { PlanDocument, PlanProjection, YearRow } from "../plan-types"
import type { AnnualHistory } from "./stress-history"
import { futurePurchases, isInvested, portfolioMix } from "./stress-levers"
import { CRYPTO_BETA, mixFor } from "./stress-mix"
import { percentile, type CohortResult } from "./stress-test"

export type InsightKey =
  | "when"
  | "housingGap"
  | "bigPurchase"
  | "incomeDrop"
  | "crunch"
  | "noPaycheck"
  | "riskyMix"
  | "lowRisk"
  | "lateMoney"
  | "soldStillFailed"
  | "illiquid"
  | "optimism"
  | "taxDrag"
/** What an insight's "See fix" points at: a solver (or What would help row) that pulls the matching lever. */
export type InsightFix = "spending" | "mix" | "retirement" | "socialSecurity" | "sell-homes" | `skip-${string}`

export interface Insight {
  key: InsightKey
  title: string
  detail: string
  fix?: InsightFix
}

/** Crypto at or past this share of invested money is called out. */
const CRYPTO_SHARE = 0.2
/** A purchase whose down payment takes this share of the accounts, or whose payments take this share of income. */
const BIG_DOWN = 0.2
const BIG_PAYMENTS = 0.3
/** A housing cost that stops this many years before any home is owned leaves a gap worth flagging. */
const GAP_YEARS = 1
/** Pay falling by this share or more before the money runs out is a cause worth naming. */
const INCOME_DROP = 0.3
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
    title: `${pct(c.ages.length / total)} of trials run out of cash, typically at ${c.age}`,
    detail: p10 === p90 ? `All of them at about ${c.age}.` : `Most between ${p10} and ${p90}.`,
  }
}

const earnedKinds = new Set(["salary", "business", "equity"])

/** The last plan year with a paycheck, or null with none. */
function lastPaycheck(c: Context): number | null {
  const earned = c.doc.incomes.filter((i) => earnedKinds.has(i.kind) && i.amount > 0)
  for (let i = c.rows.length - 1; i >= 0; i--) if (earned.some((e) => (c.rows[i].incomeBy[e.id] ?? 0) > 0)) return i
  return null
}

/**
 * The biggest purchase still ahead, when it's heavy: a down payment that takes a big bite of the accounts, payments
 * that eat a big share of income, or a loan that outlasts the paycheck.
 */
function bigPurchase(c: Context): Insight | null {
  const expanded = expandPlan(c.doc)
  const paycheck = lastPaycheck(c)
  for (const asset of futurePurchases(c.doc)) {
    const p = resolveTiming(asset.start, timingContext(c.doc))
    const row = p === null ? undefined : c.rows[p]
    if (p === null || !row || p > c.index) continue
    const before = c.rows[p - 1]?.accountsTotal ?? 0
    const loans = expanded.debts.filter((d) => d.assetId === asset.id)
    const paid = (i: number) => loans.reduce((s, d) => s + (c.rows[i]?.debtPaymentsBy[d.id] ?? 0), 0)
    let last = -1
    for (let i = c.rows.length - 1; i >= p; i--) if (paid(i) > 0) { last = i; break }
    const down = row.assetPurchases
    const yearly = c.today(paid(p + 1 < c.rows.length ? p + 1 : p), p + 1)
    const pastPay = paycheck !== null && last > paycheck ? last - paycheck : 0
    const heavy = (before > 0 && down / before >= BIG_DOWN) || yearly >= BIG_PAYMENTS * c.today(row.income, p) || pastPay > 0
    if (!heavy) continue
    const parts = [`${k(c.today(down, p))} down`, yearly > 0 ? `${k(yearly)} a year of payments until ${c.age0 + last}` : ""].filter(Boolean)
    return {
      key: "bigPurchase",
      title: `Buying ${asset.name} at ${c.age0 + p} is what drains the accounts`,
      detail: `${parts.join(" and ")}${pastPay > 0 ? `, ${pastPay} years past your last paycheck` : ""} (today's dollars).`,
      fix: `skip-${asset.id}`,
    }
  }
  return null
}

const HOUSING = /\b(rent|housing|mortgage)\b/i

/**
 * A stretch with no housing cost at all: no rent or other housing line running and no home owned, after there was
 * one and before the next one starts (rent that stops years before the home it was waiting for). Back-to-back
 * housing lines (a cheaper rent, then a bigger one) are continuous.
 */
function housingGap(c: Context): Insight | null {
  const ctx = timingContext(c.doc)
  const spans = [
    ...c.doc.expenses.filter((e) => !e.oneTime && (e.category === "Housing" || HOUSING.test(e.name))).map((e) => ({ name: e.name, kind: "cost" as const, ...resolveRange(e.start, e.end, ctx) })),
    ...c.doc.assets.filter((a) => a.kind === "home").map((a) => ({ name: a.name, kind: "home" as const, ...resolveRange(a.start, a.end, ctx) })),
  ]
  const covered = (i: number) => spans.some((s) => Math.max(0, s.start) <= i && i < s.end)
  for (let i = 1; i < c.rows.length; i++) {
    if (!covered(i - 1) || covered(i)) continue
    const before = spans.find((s) => s.end === i)
    const next = spans.filter((s) => s.start > i).sort((a, b) => a.start - b.start)[0]
    if (!before || !next || next.start - i < GAP_YEARS) continue
    return {
      key: "housingGap",
      title: `${before.name} stops at ${c.age0 + i}, but ${next.kind === "home" ? `${next.name} isn't bought` : `${next.name} doesn't start`} until ${c.age0 + next.start}`,
      detail: `${next.start - i} years with no housing cost. Check when it should stop.`,
    }
  }
  return null
}

/** Household pay over a year: every salary, business and equity income (today's dollars). */
const earnedIn = (c: Context, i: number) => c.today(c.doc.incomes.filter((x) => earnedKinds.has(x.kind)).reduce((s, x) => s + (c.rows[i]?.incomeBy[x.id] ?? 0), 0), i)

/** Before the money runs out, pay falls hard (a layoff, a lower-paid job, a partner stopping work) and spending doesn't. */
function incomeDrop(c: Context): Insight | null {
  const retirement = c.doc.milestones.find((m) => m.kind === "retirement")
  const retireIndex = retirement ? (resolveTiming(retirement.timing, timingContext(c.doc)) ?? c.rows.length) : c.rows.length
  for (let t = Math.min(c.index, retireIndex - 1); t >= 1; t--) {
    const before = earnedIn(c, t - 1)
    if (before <= 0 || earnedIn(c, t) > before * (1 - INCOME_DROP)) continue
    // The new level: the first year pay picks up again, or nothing.
    let after = earnedIn(c, t)
    for (let i = t; i <= Math.min(c.index, retireIndex - 1) && after <= 0; i++) after = earnedIn(c, i)
    if (after > before * (1 - INCOME_DROP)) continue
    return {
      key: "incomeDrop",
      title: `Pay falls from ${k(before)} to ${k(after)} a year at ${c.age0 + t}`,
      detail: `Spending doesn't fall with it: ${k(c.today(c.rows[t].expenses + c.rows[t].debtPayments, t))} a year goes out (today's dollars).`,
      fix: "spending",
    }
  }
  return null
}

/** Failed trials that had already sold a home: the backup plan ran out too. */
function soldStillFailed(failed: CohortResult[]): Insight | null {
  const sold = failed.filter((f) => (f.homeSales ?? []).some((s) => s.age <= f.depletedAge!)).length
  if (sold === 0) return null
  return {
    key: "soldStillFailed",
    title: `${pct(sold / failed.length)} of the failures had already sold the home`,
    detail: "Selling it bought time, but the proceeds ran out too.",
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
    title: `Money that arrives after ${c.age} comes too late`,
    detail: `${big.map((l) => `${l.name} (${k(l.value)}) at ${l.age}`).join(", ")}: most failures happen first.`,
  }
}

/** Failed trials that still owned a lot when the money ran out: rich on paper, nothing to spend. */
function illiquid(c: Context, failed: CohortResult[]): Insight | null {
  const equity = percentile(failed.map((f) => f.equityAtDepletion ?? 0), 0.5)
  if (equity < c.spending) return null
  return {
    key: "illiquid",
    title: `Typically ${k(equity)} of property left when the cash runs out`,
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
    title: "Your plan's steady line never runs short; real markets do",
    detail:
      history !== null && assumed > history + 0.005
        ? `It assumes ${pct(assumed)} a year after inflation, every year. History averages less for this mix and comes in booms and crashes.`
        : `It assumes ${pct(assumed)} a year after inflation, every year; the stress test replays history's booms and crashes instead.`,
  }
}

function taxDrag(c: Context): Insight | null {
  const r = c.rows[c.index]
  if (!r || r.withdrawals <= 0) return null
  const taxes = rowTaxes(r)
  const share = taxes / (r.withdrawals + r.income)
  if (share < TAX_DRAG) return null
  const why =
    r.earlyWithdrawalPenalty > 0
      ? `including ${k(c.today(r.earlyWithdrawalPenalty, c.index))} of early-withdrawal penalty for taking retirement money before 59½`
      : "mostly on investments you sell"
  return { key: "taxDrag", title: `Taxes take ${pct(share)} of what you live on by ${c.age}`, detail: `About ${k(c.today(taxes, c.index))} a year in today's dollars, ${why}.` }
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
  const found = [
    when(c, cohorts.length),
    housingGap(c),
    incomeDrop(c),
    bigPurchase(c),
    crunch(c),
    ...mixInsights(c),
    noPaycheck(c),
    lateMoney(c),
    soldStillFailed(failed),
    illiquid(c, failed),
    optimism(c, annual),
    taxDrag(c),
  ]
  return found.filter((i): i is Insight => i !== null)
}

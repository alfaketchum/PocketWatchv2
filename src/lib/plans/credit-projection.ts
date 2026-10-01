import { amortizeYear } from "./engine/engine-assets"
import { financingDebts } from "./plan-financing"
import type { Inflation } from "./plan-inflation"
import { withReplacements } from "./plan-replacements"
import { scheduledPayment } from "./plan-debt-payments"
import { planLength, resolveTiming, timingContext } from "./plan-timing"
import type { PlanCredit, PlanDebt, PlanDocument, Timing } from "./plan-types"

/**
 * A rough, rule-based path for a credit score over the plan. FICO's model is proprietary; these rules follow
 * its published factor weights and guidance, and assume every payment is made on time.
 */
const AGING_BELOW_760 = 4
const AGING_ABOVE = 2
const AGING_SLOWS_AT = 760
const CAP = 820
const SCORE_MIN = 300
const SCORE_MAX = 850
/** A new loan's hard inquiry plus the lower average account age, for the year it opens. */
const NEW_LOAN_DIP = 10
/** Paying off the last installment loan thins the credit mix for two years. */
const MIX_DIP = 5
const MIX_DIP_YEARS = 2
/** Card balances against limits: above 30% and above 10%. */
const UTILIZATION_STEPS = [
  { over: 0.3, dip: 30, label: "Card balances over 30% of limits" },
  { over: 0.1, dip: 10, label: "Card balances over 10% of limits" },
] as const
const MONTHS = 12

export interface ScoreYear {
  index: number
  year: number
  /** The score through the year, events included. */
  score: number
  /** The score a lender would see when the year starts, before any loan opened that year. */
  pricing: number
  events: string[]
}

/** Months until a level payment clears the balance, or null when it never does. */
function monthsToPayOff(balance: number, rate: number, payment: number): number | null {
  if (balance <= 0) return 0
  const r = rate / MONTHS
  if (r === 0) return payment > 0 ? Math.ceil(balance / payment) : null
  if (payment <= balance * r) return null
  return Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r))
}

interface LoanSpan {
  debt: PlanDebt
  start: number
  /** Last plan year with a payment; null when it's never paid off. */
  end: number | null
}

function loanSpans(doc: PlanDocument, debts: PlanDebt[]): LoanSpan[] {
  const ctx = timingContext(doc)
  return debts.map((debt) => {
    const start = Math.max(0, resolveTiming(debt.start, ctx) ?? 0)
    const months = monthsToPayOff(debt.balance, debt.rate, scheduledPayment(debt, 0))
    return { debt, start, end: months === null ? null : start + Math.max(0, Math.ceil(months / MONTHS) - 1) }
  })
}

/** Credit-card balances owed during each plan year, paid down by their payments. */
function cardBalances(spans: LoanSpan[], length: number): number[] {
  const owed = new Array<number>(length).fill(0)
  for (const { debt, start } of spans.filter((s) => s.debt.kind === "credit")) {
    let balance = debt.balance
    for (let i = start; i < length && balance > 0; i++) {
      owed[i] += balance
      balance = amortizeYear(balance, debt.rate, scheduledPayment(debt, i - start)).balance
    }
  }
  return owed
}

const clamp = (s: number) => Math.round(Math.min(SCORE_MAX, Math.max(SCORE_MIN, s)))

/**
 * The score year by year from `credit.score` at plan start: it creeps up as accounts age, dips the year a loan
 * opens, dips for two years after the last installment loan is paid off, and dips while card balances are high
 * against the limits (when known). `debts` are every loan the plan has, generated ones included.
 */
export function projectScores(doc: PlanDocument, debts: PlanDebt[], credit: PlanCredit): ScoreYear[] {
  const length = planLength(doc)
  const spans = loanSpans(doc, debts)
  const installment = spans.filter((s) => s.debt.kind !== "credit" && s.debt.kind !== "heloc")
  const cards = cardBalances(spans, length)
  const lastPaidOff = installment.every((s) => s.end !== null) && installment.length > 0 ? Math.max(...installment.map((s) => s.end!)) : null
  let base = credit.score
  return Array.from({ length }, (_, index) => {
    if (index > 0 && base < CAP) base = Math.min(CAP, base + (base < AGING_SLOWS_AT ? AGING_BELOW_760 : AGING_ABOVE))
    const events: string[] = []
    let ongoing = 0
    if (lastPaidOff !== null && index > lastPaidOff && index <= lastPaidOff + MIX_DIP_YEARS) {
      ongoing -= MIX_DIP
      events.push("Last installment loan paid off")
    }
    const used = credit.cardLimit ? cards[index] / credit.cardLimit : 0
    const step = UTILIZATION_STEPS.find((u) => used > u.over)
    if (step) {
      ongoing -= step.dip
      events.push(step.label)
    }
    const opened = spans.filter((s) => s.start === index && index > 0)
    for (const s of opened) events.push(`New loan: ${s.debt.name}`)
    return {
      index,
      year: doc.settings.startYear + index,
      score: clamp(base + ongoing - (opened.length > 0 ? NEW_LOAN_DIP : 0)),
      pricing: clamp(base + ongoing),
      events,
    }
  })
}

/**
 * The plan's projected score, or null without a score. Loans from planned purchases count at their typical
 * terms (their rates don't change when they open or end).
 */
export function planCreditPath(doc: PlanDocument, inflation?: Inflation): ScoreYear[] | null {
  const credit = doc.settings.credit
  if (!credit) return null
  const withAssets = { ...doc, assets: withReplacements(doc) }
  return projectScores(withAssets, [...doc.debts, ...financingDebts(withAssets, inflation)], credit)
}

/** The projected score a lender would see in the year `timing` points at, or null without a score. */
export function projectedScoreAt(doc: PlanDocument, timing: Timing): number | null {
  const path = planCreditPath(doc)
  const index = resolveTiming(timing, timingContext(doc))
  if (!path || index === null) return null
  return path[Math.min(path.length - 1, Math.max(0, index))]?.pricing ?? null
}

import { amortizeMonth, CLEARED } from "./engine/engine-assets"
import { helocTerms, scheduledPayment } from "./plan-debt-payments"
import { priceIndex, type Inflation } from "./plan-inflation"
import { resolveRange, resolveTiming, timingContext } from "./plan-timing"
import type { DollarBasis, PlanDebt, PlanDocument } from "./plan-types"

const MONTHS = 12
/** Longest schedule shown; a payment that never clears the balance stops here. */
const MAX_YEARS = 50

export interface ScheduleMonth {
  /** Payment number from the loan's start (1 = first). */
  n: number
  payment: number
  interest: number
  principal: number
  /** Owed after this payment. */
  balance: number
}

export interface ScheduleYear {
  /** Plan year index (0 = first plan year). */
  index: number
  year: number
  payment: number
  interest: number
  principal: number
  /** Owed at the end of the year. */
  balance: number
  months: ScheduleMonth[]
  /** Past the plan's last year: shown for the whole loan, not simulated. */
  afterPlan: boolean
}

export interface LoanSchedule {
  debt: PlanDebt
  years: ScheduleYear[]
  totalPaid: number
  totalInterest: number
  /** First payment where more goes to principal than to interest; null if that never happens. */
  crossover: { n: number; year: number } | null
  /** Calendar year of the last payment, or null when the schedule never clears the balance. */
  payoffYear: number | null
  /** The linked asset is sold first: what's left is paid from the sale at the start of `year`. */
  paidFromSale: { index: number; year: number; amount: number } | null
  /** A HELOC's last interest-only year. */
  drawEndsYear: number | null
  /** The payment doesn't cover the interest. */
  neverPaysOff: boolean
}

/** Plan year in which the debt's linked asset is sold (start of year), if it's sold within the plan. */
function saleIndex(doc: PlanDocument, debt: PlanDebt, length: number): number | null {
  const asset = debt.assetId ? doc.assets.find((a) => a.id === debt.assetId) : undefined
  if (!asset) return null
  const range = resolveRange(asset.start, asset.end, timingContext(doc))
  return range.end < length && range.end > Math.max(0, range.start) ? range.end : null
}

function stepYear(debt: PlanDebt, balance: number, yearsIn: number, firstN: number): ScheduleMonth[] {
  const months: ScheduleMonth[] = []
  let remaining = balance
  const payment = scheduledPayment(debt, yearsIn)
  for (let m = 0; m < MONTHS && remaining > CLEARED; m++) {
    const step = amortizeMonth(remaining, debt.rate, payment)
    remaining = step.balance > CLEARED ? step.balance : 0
    months.push({ n: firstN + m, payment: step.paid, interest: step.interest, principal: step.paid - step.interest, balance: remaining })
  }
  return months
}

function sumYear(index: number, year: number, months: ScheduleMonth[], afterPlan: boolean): ScheduleYear {
  const total = (k: "payment" | "interest" | "principal") => months.reduce((s, m) => s + m[k], 0)
  return { index, year, payment: total("payment"), interest: total("interest"), principal: total("principal"), balance: months[months.length - 1].balance, months, afterPlan }
}

/**
 * Month-by-month payments on one loan of the (expanded) plan, with the same math the simulation uses:
 * paid from its start until cleared, or until its asset is sold. Amounts are in each year's own dollars.
 */
export function loanSchedule(view: PlanDocument, debtId: string): LoanSchedule | null {
  const debt = view.debts.find((d) => d.id === debtId)
  if (!debt) return null
  const ctx = timingContext(view)
  const start = Math.max(0, resolveTiming(debt.start, ctx) ?? 0)
  const sale = saleIndex(view, debt, ctx.length)
  const { startYear } = view.settings
  const years: ScheduleYear[] = []
  let balance = debt.balance
  let n = 1
  for (let i = start; i < start + MAX_YEARS && balance > CLEARED && (sale === null || i < sale); i++) {
    const months = stepYear(debt, balance, i - start, n)
    years.push(sumYear(i, startYear + i, months, i >= ctx.length))
    balance = months[months.length - 1].balance
    n += months.length
  }
  const allMonths = years.flatMap((y) => y.months.map((m) => ({ ...m, year: y.year })))
  const cross = allMonths.find((m) => m.interest > 0 && m.principal >= m.interest) ?? null
  const terms = helocTerms(debt)
  const cleared = balance <= CLEARED
  return {
    debt,
    years,
    totalPaid: years.reduce((s, y) => s + y.payment, 0),
    totalInterest: years.reduce((s, y) => s + y.interest, 0),
    crossover: cross && { n: cross.n, year: cross.year },
    payoffYear: cleared && years.length > 0 ? years[years.length - 1].year : null,
    paidFromSale: !cleared && sale !== null && years.length < MAX_YEARS ? { index: sale, year: startYear + sale, amount: balance } : null,
    drawEndsYear: terms && terms.drawYears > 0 ? startYear + start + terms.drawYears - 1 : null,
    neverPaysOff: debt.balance > 0 && scheduledPayment(debt, Number.MAX_SAFE_INTEGER) <= (debt.balance * debt.rate) / MONTHS,
  }
}

/**
 * A schedule in today's dollars, deflated like the rest of the plan: payments by their year's prices,
 * balances by the prices at the end of their month (so December matches the year-end balance).
 */
export function scheduleInBasis(schedule: LoanSchedule, basis: DollarBasis, inflation: Inflation): LoanSchedule {
  if (basis === "future") return schedule
  const years = schedule.years.map((y) => {
    const flow = priceIndex(inflation, y.index)
    const months = y.months.map((m, k) => {
      const atEnd = priceIndex(inflation, y.index + (k + 1) / MONTHS)
      return { ...m, payment: m.payment / flow, interest: m.interest / flow, principal: m.principal / flow, balance: m.balance / atEnd }
    })
    return { ...y, months, payment: y.payment / flow, interest: y.interest / flow, principal: y.principal / flow, balance: y.balance / priceIndex(inflation, y.index + 1) }
  })
  return {
    ...schedule,
    years,
    totalPaid: years.reduce((s, y) => s + y.payment, 0),
    totalInterest: years.reduce((s, y) => s + y.interest, 0),
    paidFromSale: schedule.paidFromSale && { ...schedule.paidFromSale, amount: schedule.paidFromSale.amount / priceIndex(inflation, schedule.paidFromSale.index) },
  }
}

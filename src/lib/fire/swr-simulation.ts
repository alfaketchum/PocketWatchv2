/**
 * Historical safe-withdrawal-rate engine modeled on Early Retirement Now's SWR series:
 * monthly real returns since 1871, withdrawals at the start of each month,
 * a fee drag, a real final-value target, glidepaths, and supplemental cash flows.
 */
import { FEE_DRAG_ANNUAL } from "./fire-constants"
import type {
  CohortSummary,
  EquityPlan,
  FireFlow,
  MarketHistory,
  MonthlyFlow,
  ShillerDataset,
  SimOptions,
} from "./fire-types"

export function parseDataset(data: ShillerDataset): MarketHistory {
  const n = data.rows.length
  const equity = new Float64Array(n)
  const bonds = new Float64Array(n)
  const months: string[] = new Array(n)
  const cape: (number | null)[] = new Array(n)
  data.rows.forEach(([ym, e, b, c], i) => {
    months[i] = ym
    equity[i] = e
    bonds[i] = b
    cape[i] = c
  })
  return {
    months,
    equity,
    bonds,
    cape,
    dataThrough: data.dataThrough,
    latestCape: data.latestCape,
    latestCapeMonth: data.latestCapeMonth,
  }
}

export function constantEquity(share: number, cash = 0): EquityPlan {
  return { start: share, end: share, glideMonths: 0, cash }
}

export function equityAt(plan: EquityPlan, month: number): number {
  if (plan.glideMonths <= 0) return plan.start
  if (month >= plan.glideMonths) return plan.end
  return plan.start + (plan.end - plan.start) * (month / plan.glideMonths)
}

/** Converts age-based annual flows into monthly flows relative to the initial portfolio. */
export function toMonthlyFlows(flows: FireFlow[], retireAge: number, portfolio: number): MonthlyFlow[] {
  if (portfolio <= 0) return []
  return flows
    .filter((f) => f.annualAmount !== 0)
    .map((f) => ({
      startMonth: Math.max(0, Math.round((f.startAge - retireAge) * 12)),
      endMonth: f.endAge == null ? Number.MAX_SAFE_INTEGER : Math.round((f.endAge + 1 - retireAge) * 12),
      amount: f.annualAmount / 12 / portfolio,
    }))
    .filter((f) => f.endMonth > f.startMonth)
}

function flowAt(flows: MonthlyFlow[], month: number): number {
  let total = 0
  for (const f of flows) {
    if (month >= f.startMonth && month < f.endMonth) total += f.amount
  }
  return total
}

/**
 * One month's real growth factor. Cash earns 0% real (Shiller has no T-bill series, so
 * this is a deliberately conservative stand-in); stocks are capped so shares never exceed 1.
 */
function monthFactor(h: MarketHistory, idx: number, equity: number, cash: number, feeMonthly: number): number {
  const eq = Math.min(equity, 1 - cash)
  const bonds = Math.max(0, 1 - eq - cash)
  return 1 + eq * h.equity[idx] + bonds * h.bonds[idx] - feeMonthly
}

/** Number of complete retirement cohorts available for a horizon. */
export function cohortCount(h: MarketHistory, horizonMonths: number): number {
  return Math.max(0, h.months.length - horizonMonths + 1)
}

/**
 * Max annual withdrawal rate (fraction of initial portfolio) for the cohort starting at
 * `start` that ends exactly at the final-value target. Closed form, as in ERN's sheet:
 * W = (1 − FV/G_T + Σ F_t/G_t) / Σ 1/G_t, with G_t the cumulative real growth factor.
 */
export function maxSafeWr(h: MarketHistory, start: number, opts: SimOptions): number {
  const feeMonthly = opts.feeAnnual / 12
  let growth = 1
  let sumInv = 0
  let flowPv = 0
  for (let t = 0; t < opts.horizonMonths; t++) {
    const inv = 1 / growth
    sumInv += inv
    flowPv += flowAt(opts.flows, t) * inv
    growth *= monthFactor(h, start + t, equityAt(opts.equity, t), opts.equity.cash ?? 0, feeMonthly)
  }
  return (12 * (1 - opts.finalValue / growth + flowPv)) / sumInv
}

/** Monthly real portfolio path (initial = 1) for a fixed annual withdrawal rate. Floors at 0. */
export function simulateCohort(h: MarketHistory, start: number, wr: number, opts: SimOptions): Float64Array {
  const feeMonthly = opts.feeAnnual / 12
  const withdrawal = wr / 12
  const path = new Float64Array(opts.horizonMonths + 1)
  let value = 1
  path[0] = value
  for (let t = 0; t < opts.horizonMonths; t++) {
    if (value > 0) {
      const afterFlows = value - withdrawal + flowAt(opts.flows, t)
      value = Math.max(0, afterFlows) * monthFactor(h, start + t, equityAt(opts.equity, t), opts.equity.cash ?? 0, feeMonthly)
    }
    path[t + 1] = value
  }
  return path
}

function annualizedReturn(h: MarketHistory, start: number, months: number, opts: SimOptions): number | null {
  if (start + months > h.months.length) return null
  const feeMonthly = opts.feeAnnual / 12
  let growth = 1
  for (let t = 0; t < months; t++) growth *= monthFactor(h, start + t, equityAt(opts.equity, t), opts.equity.cash ?? 0, feeMonthly)
  return Math.pow(growth, 12 / months) - 1
}

/** Max safe WR, CAPE and early-sequence return for every complete cohort. */
export function summarizeCohorts(h: MarketHistory, opts: SimOptions): CohortSummary[] {
  const count = cohortCount(h, opts.horizonMonths)
  const out: CohortSummary[] = new Array(count)
  for (let s = 0; s < count; s++) {
    out[s] = {
      startIndex: s,
      month: h.months[s],
      maxWr: maxSafeWr(h, s, opts),
      cape: h.cape[s],
      first10YrReturn: annualizedReturn(h, s, 120, opts),
    }
  }
  return out
}

/** Lowest max-safe WR across all cohorts (ERN's "failsafe" WR) and the worst cohort. */
export function failsafe(summaries: CohortSummary[]): { wr: number; month: string } | null {
  if (summaries.length === 0) return null
  const worst = summaries.reduce((min, c) => (c.maxWr < min.maxWr ? c : min))
  return { wr: worst.maxWr, month: worst.month }
}

/**
 * Share of cohorts that sustain `wr` and still end at or above the final-value target.
 * Uses path simulation so mid-retirement depletion counts as a failure even when later
 * supplemental income would have "refilled" the portfolio.
 */
export function successRate(h: MarketHistory, wr: number, opts: SimOptions): number | null {
  const count = cohortCount(h, opts.horizonMonths)
  if (count === 0) return null
  let ok = 0
  for (let s = 0; s < count; s++) {
    const path = simulateCohort(h, s, wr, opts)
    const final = path[path.length - 1]
    if (final > 0 && final >= opts.finalValue - 1e-9) ok++
  }
  return ok / count
}

export function defaultSimOptions(partial: Partial<SimOptions> & { horizonMonths: number }): SimOptions {
  return {
    equity: constantEquity(0.75),
    finalValue: 0,
    feeAnnual: FEE_DRAG_ANNUAL,
    flows: [],
    ...partial,
  }
}

import { constantEquity, defaultSimOptions, successRate } from "@/lib/fire/swr-simulation"
import type { MarketHistory, MonthlyFlow } from "@/lib/fire/fire-types"
import { rowInTodaysDollars } from "./plan-dollars"
import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanProjection } from "./plan-types"

const MONTHS = 12

export interface BacktestInput {
  /** Portfolio at retirement, today's dollars. */
  portfolio: number
  horizonMonths: number
  /** The plan's yearly net draw (or deposit) after retirement, as fractions of the portfolio. */
  flows: MonthlyFlow[]
}

/**
 * The plan's retirement years as a withdrawal schedule for the historical engine. Each year's net
 * flow is what the plan puts into (+) or needs from (−) its accounts, taxes on withdrawals included.
 * Null when the plan has no retirement inside its span or nothing saved by then.
 */
export function backtestInput(doc: PlanDocument, projection: PlanProjection): BacktestInput | null {
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const retireIndex = retirement ? resolveTiming(retirement.timing, timingContext(doc)) : null
  const rows = projection.rows.map((r) => rowInTodaysDollars(r, doc.settings.inflation))
  if (retireIndex === null || retireIndex < 0 || retireIndex >= rows.length) return null
  const portfolio = retireIndex === 0 ? doc.accounts.reduce((s, a) => s + a.balance, 0) : rows[retireIndex - 1].accountsTotal
  if (portfolio <= 0) return null
  const flows = rows.slice(retireIndex).map((row, k) => ({
    startMonth: k * MONTHS,
    endMonth: (k + 1) * MONTHS,
    // Unmet spending (shortfall) still counts: history may have funded it where the plan's fixed returns didn't.
    amount: (row.contributions - row.withdrawals - row.shortfall) / MONTHS / portfolio,
  }))
  return { portfolio, horizonMonths: flows.length * MONTHS, flows }
}

/** Share of historical start months (since 1871) in which the plan's retirement never runs dry. */
export function planSuccessRate(h: MarketHistory, input: BacktestInput, equityShare: number): number | null {
  const opts = defaultSimOptions({ horizonMonths: input.horizonMonths, flows: input.flows, equity: constantEquity(equityShare) })
  return successRate(h, 0, opts)
}

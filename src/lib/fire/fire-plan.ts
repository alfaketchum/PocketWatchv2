import { resolveSwr } from "./cape-rule"
import type { FireBaseline, FireInputs } from "./fire-types"

export interface TrendMonthLike {
  month: string
  income: number
  spending: number
}

export interface NetWorthLike {
  totalNetWorth: number
  fiat: { cash: number; savings: number; investments: number; debt: number }
  crypto: { value: number }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

/**
 * Auto-filled FIRE baseline from existing PocketWatch data. The current (partial) month
 * is skipped. When the user has set a monthly income override it wins over the
 * Income-category total, which misses investment income.
 */
export function buildBaseline(
  netWorth: NetWorthLike | undefined,
  trendMonths: TrendMonthLike[],
  monthlyIncomeOverride: number | null,
  currentMonth: string,
): FireBaseline {
  const complete = trendMonths.filter((m) => m.month < currentMonth && m.spending > 0)
  const avgSpend = average(complete.map((m) => m.spending))
  const typicalSpend = median(complete.map((m) => m.spending))
  const avgIncome = monthlyIncomeOverride ?? average(complete.map((m) => m.income))
  const annualSpend = avgSpend !== null ? avgSpend * 12 : null
  const annualIncome = avgIncome !== null ? avgIncome * 12 : null
  const annualContribution =
    annualIncome !== null && annualSpend !== null ? Math.max(0, annualIncome - annualSpend) : null
  return {
    investable: {
      cash: netWorth?.fiat.cash ?? 0,
      savings: netWorth?.fiat.savings ?? 0,
      investments: netWorth?.fiat.investments ?? 0,
      crypto: netWorth?.crypto.value ?? 0,
      debt: netWorth?.fiat.debt ?? 0,
    },
    netWorth: netWorth?.totalNetWorth ?? 0,
    avgAnnualSpend: annualSpend,
    typicalAnnualSpend: typicalSpend !== null ? typicalSpend * 12 : null,
    annualIncome,
    annualContribution,
    savingsRate: annualIncome && annualContribution !== null ? annualContribution / annualIncome : null,
    monthsOfData: complete.length,
  }
}

export function investableFromBaseline(inputs: FireInputs, baseline: FireBaseline): number {
  const b = baseline.investable
  return b.investments + b.savings + (inputs.includeCash ? b.cash : 0) + (inputs.includeCrypto ? b.crypto : 0)
}

/** Effective plan values: saved overrides win, otherwise the baseline. */
export interface ResolvedPlan {
  investable: number
  annualSpend: number
  annualContribution: number
  swr: number
  spendIsAuto: boolean
  contributionIsAuto: boolean
  investableIsAuto: boolean
}

export function resolvePlan(inputs: FireInputs, baseline: FireBaseline, currentCape: number | null): ResolvedPlan {
  return {
    investable: inputs.investableOverride ?? investableFromBaseline(inputs, baseline),
    annualSpend: inputs.annualSpend ?? baseline.avgAnnualSpend ?? 0,
    annualContribution: inputs.annualContribution ?? baseline.annualContribution ?? 0,
    swr: resolveSwr(inputs, currentCape),
    spendIsAuto: inputs.annualSpend === null,
    contributionIsAuto: inputs.annualContribution === null,
    investableIsAuto: inputs.investableOverride === null,
  }
}

import { EQUITY_STEPS, FEE_DRAG_ANNUAL, SWR_HORIZONS } from "./fire-constants"
import type { MarketHistory } from "./fire-types"

export interface SwrGridCell {
  horizonYears: number
  equityShare: number
  failsafeWr: number
  /** Share of cohorts whose max safe WR is at least the probe rate. */
  successAtProbe: number
  cohorts: number
}

/**
 * Failsafe WR / success rate for every horizon × constant equity share.
 * Constant allocations make the monthly factor start-independent, so prefix products
 * turn each cohort's closed-form max WR into O(1): Σ_{t<T} 1/G_t = P_s · (S_{s+T} − S_s).
 */
export function buildSwrGrid(
  h: MarketHistory,
  finalValue: number,
  probeWr: number,
  horizons: readonly number[] = SWR_HORIZONS,
  equitySteps: readonly number[] = EQUITY_STEPS,
): SwrGridCell[] {
  const cells: SwrGridCell[] = []
  for (const equity of equitySteps) {
    const { prod, invSum } = prefixSeries(h, equity)
    for (const years of horizons) {
      cells.push(gridCell(prod, invSum, years, equity, finalValue, probeWr))
    }
  }
  return cells
}

function prefixSeries(h: MarketHistory, equity: number): { prod: Float64Array; invSum: Float64Array } {
  const n = h.months.length
  const feeMonthly = FEE_DRAG_ANNUAL / 12
  const prod = new Float64Array(n + 1)
  const invSum = new Float64Array(n + 1)
  prod[0] = 1
  for (let i = 0; i < n; i++) {
    invSum[i + 1] = invSum[i] + 1 / prod[i]
    prod[i + 1] = prod[i] * (1 + equity * h.equity[i] + (1 - equity) * h.bonds[i] - feeMonthly)
  }
  return { prod, invSum }
}

function gridCell(
  prod: Float64Array,
  invSum: Float64Array,
  years: number,
  equity: number,
  finalValue: number,
  probeWr: number,
): SwrGridCell {
  const horizon = years * 12
  const count = Math.max(0, prod.length - horizon)
  let minWr = Infinity
  let ok = 0
  for (let s = 0; s < count; s++) {
    const growth = prod[s + horizon] / prod[s]
    const sumInv = prod[s] * (invSum[s + horizon] - invSum[s])
    const wr = (12 * (1 - finalValue / growth)) / sumInv
    if (wr < minWr) minWr = wr
    if (wr >= probeWr) ok++
  }
  return {
    horizonYears: years,
    equityShare: equity,
    failsafeWr: count > 0 ? minWr : NaN,
    successAtProbe: count > 0 ? ok / count : NaN,
    cohorts: count,
  }
}

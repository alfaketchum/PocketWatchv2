export interface BreakdownPoint {
  date: string
  cash: number
  savings: number
  investment: number
  stablecoin: number
  digital: number
}

export interface InvestablePoint {
  /** Fractional year, e.g. 2026.5, so history and projections share an x-axis. */
  x: number
  value: number
}

function fractionalYear(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  return y + (m - 1) / 12 + ((d || 1) - 1) / 365
}

/**
 * Investable-asset history from the net-worth breakdown series, using the same
 * cash/crypto toggles as the plan, downsampled to the last point of each month.
 */
export function investableHistory(
  breakdown: BreakdownPoint[],
  includeCash: boolean,
  includeCrypto: boolean,
): InvestablePoint[] {
  const byMonth = new Map<string, InvestablePoint>()
  for (const p of breakdown) {
    const value =
      p.investment + p.savings + (includeCash ? p.cash : 0) + (includeCrypto ? p.stablecoin + p.digital : 0)
    byMonth.set(p.date.slice(0, 7), { x: fractionalYear(p.date), value })
  }
  return [...byMonth.values()].sort((a, b) => a.x - b.x)
}

export function nowFractionalYear(now: Date): number {
  return fractionalYear(now.toISOString())
}

import type { YearRow } from "../plan-types"

/** Under this many years of spending in your accounts counts as the danger zone. */
export const DANGER_YEARS = 3

export interface CloseCall {
  /** Fewest years of spending your accounts could cover, and the age then; null if you never lived off them. */
  lowPoint: { years: number; age: number } | null
  /**
   * The area under the danger line: each year in the zone adds how far under it was, as a share of the line. One
   * danger-year is a year at $0; a year at half the cushion counts half.
   */
  dangerArea: number
  /** Each year's cushion in years of spending; null in years you weren't living off your accounts. */
  cushion: (number | null)[]
}

/** A year's cushion: the money in your accounts over that year's bills and debt payments. Ratios, so dollars don't matter. */
function cushion(r: YearRow): number | null {
  const living = r.withdrawals > 0 || r.shortfall > 0
  const spending = r.expenses + r.debtPayments
  if (!living || spending <= 0) return null
  return r.accountsTotal / spending
}

/** How close a run came to running out: its lowest point and its time in the danger zone, counting only years you lived off your accounts. */
export function closeCall(rows: YearRow[], age0: number): CloseCall {
  let lowPoint: CloseCall["lowPoint"] = null
  let dangerArea = 0
  const series = rows.map(cushion)
  for (const r of rows) {
    const c = series[r.index]
    if (c === null) continue
    if (!lowPoint || c < lowPoint.years) lowPoint = { years: c, age: age0 + r.index }
    dangerArea += Math.max(0, DANGER_YEARS - c) / DANGER_YEARS
  }
  return { lowPoint, dangerArea, cushion: series }
}

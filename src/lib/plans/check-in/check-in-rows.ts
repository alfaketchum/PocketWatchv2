import type { ProgressPoint } from "../plan-progress"

/** A check-in as the API returns it. Flows are per month, nominal $. */
export interface PlanCheckInRow {
  /** "YYYY-MM" */
  month: string
  planId: string | null
  planName: string
  planHash: string
  plannedSource: "live" | "backfill"
  plannedNetWorth: number | null
  plannedIncome: number
  plannedSpending: number
  plannedByCategory: Record<string, number>
  plannedOneTime: number
  actualNetWorth: number | null
  actualIncome: number
  actualSpending: number
  actualByCategory: Record<string, number>
}

export interface CategoryComparison {
  category: string
  actual: number
  planned: number
  /** Positive when over plan. */
  over: number
}

/** True where the plan was different from the month before (rows newest first; the oldest row is never flagged). */
export function planChangedFlags(rows: PlanCheckInRow[]): boolean[] {
  return rows.map((row, i) => {
    const older = rows[i + 1]
    return older !== undefined && older.planHash !== row.planHash
  })
}

/** Every category in either side, biggest overspend first. */
export function compareCategories(row: PlanCheckInRow): CategoryComparison[] {
  const categories = new Set([...Object.keys(row.plannedByCategory), ...Object.keys(row.actualByCategory)])
  return [...categories]
    .map((category) => {
      const actual = row.actualByCategory[category] ?? 0
      const planned = row.plannedByCategory[category] ?? 0
      return { category, actual, planned, over: actual - planned }
    })
    .sort((a, b) => b.over - a.over)
}

/** Where the plan stood at each recorded month end, on the chart's fractional-year axis (oldest first). */
export function plannedAtTheTime(rows: PlanCheckInRow[]): ProgressPoint[] {
  return rows
    .filter((r) => r.plannedNetWorth !== null && r.plannedSource === "live")
    .map((r) => {
      const [year, month] = r.month.split("-").map(Number)
      return { x: year + month / 12, value: r.plannedNetWorth as number }
    })
    .sort((a, b) => a.x - b.x)
}

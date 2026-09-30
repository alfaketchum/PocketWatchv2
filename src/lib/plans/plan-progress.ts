import { fractionalYear } from "@/lib/fire/fire-history"
import type { PlanDocument, PlanProjection } from "./plan-types"

/** A value on a fractional-year axis, e.g. 2026.5 for mid-2026. */
export interface ProgressPoint {
  x: number
  value: number
}

/** The plan's financial net worth (accounts − debts, nominal $) from its start date, one point per year. */
export function planPath(doc: PlanDocument, projection: PlanProjection): ProgressPoint[] {
  const start = doc.settings.startYear + (doc.settings.startMonth - 1) / 12
  return [
    { x: start, value: projection.startFinancialNetWorth },
    ...projection.rows.map((r) => ({ x: start + r.index + 1, value: r.financialNetWorth })),
  ]
}

/** Linear interpolation along a path; null outside it. */
export function valueAt(path: ProgressPoint[], x: number): number | null {
  if (path.length === 0 || x < path[0].x || x > path[path.length - 1].x) return null
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    if (x <= b.x) return b.x === a.x ? b.value : a.value + ((x - a.x) / (b.x - a.x)) * (b.value - a.value)
  }
  return path[path.length - 1].value
}

/** Daily net-worth history reduced to the last point of each month. */
export function monthlyActual(history: { date: string; total: number }[]): ProgressPoint[] {
  const byMonth = new Map<string, ProgressPoint>()
  for (const p of history) byMonth.set(p.date.slice(0, 7), { x: fractionalYear(p.date), value: p.total })
  return [...byMonth.values()].sort((a, b) => a.x - b.x)
}

export interface ProgressStatus {
  /** The latest actual point. */
  asOf: number
  actual: number
  planned: number
  /** Positive when ahead of plan. */
  difference: number
}

/** How the latest actual net worth compares to where the plan said it would be; null before the plan starts. */
export function progressStatus(path: ProgressPoint[], actual: ProgressPoint[]): ProgressStatus | null {
  const latest = actual[actual.length - 1]
  if (!latest) return null
  const planned = valueAt(path, latest.x)
  if (planned === null) return null
  return { asOf: latest.x, actual: latest.value, planned, difference: latest.value - planned }
}

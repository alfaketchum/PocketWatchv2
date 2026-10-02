import type { ChartMilestone } from "@/lib/plans/plan-chart"
import type { ChartRow, Series } from "./use-chart-series"

const Y_HEADROOM = 1.03

/** Stack position of each milestone among those in the same year (0 = lowest). */
export function stackMarks(marks: ChartMilestone[]): { mark: ChartMilestone; level: number }[] {
  const seen = new Map<number, number>()
  return marks.map((mark) => {
    const level = seen.get(mark.age) ?? 0
    seen.set(mark.age, level + 1)
    return { mark, level }
  })
}

const TICK_INTERVALS = 6
/** Room below zero, relative to the deepest negative bar, when that's less than a tick step. */
const NEG_ROOM = 1.25

/** 1, 2, 2.5 or 5 × a power of ten: a round step near `raw`. */
function roundStep(raw: number): number {
  if (raw <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10
  return step * magnitude
}

/** Round ticks that hug the stacked bars, so the tallest one nearly fills the plot. */
export function fitAxis(rows: ChartRow[], series: Series[], atLeast = 0): { domain: [number, number]; ticks: number[] } {
  let top = atLeast
  let bottom = 0
  for (const row of rows) {
    const values = series.map((s) => row[s.key] ?? 0)
    top = Math.max(
      top,
      values.reduce((sum, v) => sum + Math.max(0, v), 0),
    )
    bottom = Math.min(
      bottom,
      values.reduce((sum, v) => sum + Math.min(0, v), 0),
    )
  }
  const step = roundStep(((top - bottom) * Y_HEADROOM) / TICK_INTERVALS)
  const hi = Math.ceil((top * Y_HEADROOM) / step) * step
  // Below zero, room for what's there (not a whole step for a small loan); ticks stay on round steps.
  const stepped = -step * Math.ceil((-bottom * Y_HEADROOM) / step)
  // Debt smaller than a step still gets one round number below zero (−$50k for −$37k), so it has a scale.
  const roundBelow = bottom < 0 ? -roundStep(-bottom) : 0
  const lo = bottom >= 0 ? 0 : Math.min(Math.max(stepped, bottom * NEG_ROOM), Math.max(stepped, roundBelow))
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step / 2; t += step) ticks.push(Math.round(t))
  if (bottom < 0 && !ticks.some((t) => t < 0)) ticks.unshift(Math.round(roundBelow))
  return { domain: [lo, hi], ticks }
}

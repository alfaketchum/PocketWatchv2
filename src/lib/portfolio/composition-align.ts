/**
 * Fits the stacked breakdown (Stable vs Digital, By asset) to the Total line, so every view of the
 * portfolio chart shows the same value on the same day. The composition route supplies each day's mix;
 * the Total series (history/snapshots) supplies the level.
 */

import type { CompositionResponse } from "@/types/composition"

type StackedPoint = CompositionResponse["points"][number]

export interface TotalPoint {
  /** Epoch seconds */
  time: number
  value: number
}

const sumOf = (values: Record<string, number>) => Object.values(values).reduce((s, v) => s + v, 0)

function scalePoint(point: StackedPoint, t: number, factor: number): StackedPoint {
  const values = Object.fromEntries(Object.entries(point.values).map(([k, v]) => [k, v * factor]))
  const details = point.details
    ? Object.fromEntries(Object.entries(point.details).map(([k, rows]) => [k, rows.map((r) => ({ ...r, value: r.value * factor }))]))
    : undefined
  return { ...point, t, values, ...(details ? { details } : {}) }
}

/**
 * One stacked point per Total point: the mix of the latest breakdown day at or before it (the first one
 * for earlier points), scaled so the layers add up to the Total value. Days with no breakdown value borrow
 * the last mix that had one. Returns the breakdown unchanged when there's no Total series.
 */
export function alignToTotal(points: StackedPoint[], total: TotalPoint[]): StackedPoint[] {
  const mixes = points.filter((p) => sumOf(p.values) > 0)
  if (total.length === 0 || mixes.length === 0) return points
  let i = 0
  return total.map((tp) => {
    const t = tp.time * 1000
    while (i + 1 < mixes.length && mixes[i + 1].t <= t) i++
    const mix = mixes[i]
    return scalePoint(mix, t, tp.value / sumOf(mix.values))
  })
}

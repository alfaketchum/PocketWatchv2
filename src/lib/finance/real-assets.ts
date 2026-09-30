/** Homes, vehicles and other things valued by hand: estimated values over time. */

export type RealAssetKind = "home" | "vehicle" | "other"

export const REAL_ASSET_KINDS: RealAssetKind[] = ["home", "vehicle", "other"]

/** Typical yearly value change, pre-filled when adding one. */
export const TYPICAL_APPRECIATION: Record<RealAssetKind, number> = { home: 0.03, vehicle: -0.15, other: 0 }

const MS_PER_YEAR = 365.25 * 86_400_000

export interface ValuedAsset {
  kind: string
  value: number
  valueAsOf: Date
  appreciation: number
  purchasePrice: number | null
  purchaseDate: Date | null
  values: { date: Date; value: number }[]
}

/** Known values, oldest first: the purchase (if its price and date are known), each update and the latest. */
function knownPoints(asset: ValuedAsset): { t: number; value: number }[] {
  const points = [
    ...(asset.purchasePrice !== null && asset.purchaseDate ? [{ t: asset.purchaseDate.getTime(), value: asset.purchasePrice }] : []),
    ...asset.values.map((v) => ({ t: v.date.getTime(), value: v.value })),
    { t: asset.valueAsOf.getTime(), value: asset.value },
  ]
  return points.sort((a, b) => a.t - b.t)
}

/**
 * Estimated value on `at`: the last known value before it, grown (or shrunk) by the yearly change since.
 * Zero before it was owned — the purchase date, or with none the first recorded value, so nothing is
 * invented for years before the user told us about it.
 */
export function valueAt(asset: ValuedAsset, at: Date): number {
  const points = knownPoints(asset)
  const t = at.getTime()
  const ownedFrom = asset.purchaseDate?.getTime() ?? points[0].t
  if (t < ownedFrom) return 0
  const base = [...points].reverse().find((p) => p.t <= t) ?? points[0]
  return base.value * Math.pow(1 + asset.appreciation, (t - base.t) / MS_PER_YEAR)
}

export interface RealAssetTotals {
  home: number
  vehicle: number
  other: number
  total: number
}

export function totalsAt(assets: ValuedAsset[], at: Date): RealAssetTotals {
  const totals = { home: 0, vehicle: 0, other: 0, total: 0 }
  for (const a of assets) {
    const v = valueAt(a, at)
    const kind: RealAssetKind = a.kind === "home" || a.kind === "vehicle" ? a.kind : "other"
    totals[kind] += v
    totals.total += v
  }
  return totals
}

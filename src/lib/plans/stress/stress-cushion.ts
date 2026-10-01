import { BANDS, percentile } from "./stress-test"

/** An age with fewer periods than this share living off their accounts is left out of the cushion chart. */
const MIN_LIVING_SHARE = 0.5

/**
 * The spread of cushions by plan year across periods: 10/25/50/75/90th percentiles of the periods living off their
 * accounts then, or null when most are still working (income pays the bills, so a cushion means nothing yet).
 */
export function cushionBands(cushions: (number | null)[][]): (number[] | null)[] {
  const years = Math.max(0, ...cushions.map((c) => c.length))
  return Array.from({ length: years }, (_, i) => {
    const values = cushions.flatMap((c) => (c[i] != null ? [c[i] as number] : []))
    if (values.length === 0 || values.length < cushions.length * MIN_LIVING_SHARE) return null
    return BANDS.map((p) => percentile(values, p))
  })
}

import { resolveRange, timingContext } from "./plan-timing"
import type { PlanAsset, PlanDocument, Timing } from "./plan-types"

/**
 * Assets with a replacement cycle, unrolled: the asset is sold after `replaceEveryYears` and a like one
 * bought the same year (today's price grown by inflation), until the asset's own sale or the plan's end.
 * Later ones get ids `<id>~2`, `<id>~3`…; each carries the original's payment choice and running costs.
 * The cycle is cleared on the results, so unrolling twice changes nothing.
 */
export function withReplacements(doc: PlanDocument): PlanAsset[] {
  const ctx = timingContext(doc)
  const year = (index: number): Timing => ({ type: "year", year: doc.settings.startYear + index })
  return doc.assets.flatMap((asset) => {
    const every = asset.replaceEveryYears
    if (!every || every < 1) return [asset]
    const range = resolveRange(asset.start, asset.end, ctx)
    const first = Math.max(0, range.start)
    const stop = Math.min(range.end, ctx.length)
    const base: PlanAsset = { ...asset, replaceEveryYears: null }
    if (first >= stop) return [base]
    const out: PlanAsset[] = []
    for (let k = 0, from = first; from < stop; k++, from += every) {
      const to = from + every
      const replaced = to < stop
      const end = replaced ? year(to) : asset.end
      out.push(
        k === 0
          ? { ...base, end, ...(replaced ? { replaced } : {}) }
          : {
              ...base,
              id: `${asset.id}~${k + 1}`,
              start: year(from),
              end,
              acquired: "purchase",
              costBasis: null,
              replacementOf: asset.id,
              ...(replaced ? { replaced } : {}),
            },
      )
    }
    return out
  })
}

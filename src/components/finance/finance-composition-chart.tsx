"use client"

import { useMemo } from "react"
import { useFinanceComposition } from "@/hooks/finance/use-finance-composition"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { useNetWorthCategories } from "@/hooks/use-net-worth-colors"
import { StackedAreaChart, type StackLayer } from "@/components/ui/stacked-area-chart"
import { distinctBandColors } from "@/lib/chart-band-colors"
import type { FinanceCompositionMode } from "@/types/composition"

const NEUTRAL_COLOR = "#8a8f98"

interface Props {
  mode: FinanceCompositionMode
  range: string
  includeInvestments: boolean
  height: number
  isHidden: boolean
}

/** Stacked breakdown of finance assets: by account group, or per account. Debt shows in the tooltip. */
export function FinanceCompositionChart({ mode, range, includeInvestments, height, isHidden }: Props) {
  const { data, isLoading, isError } = useFinanceComposition(mode, range, includeInvestments)
  const theme = useChartTheme()
  const cats = useNetWorthCategories()

  const layers = useMemo<StackLayer[]>(() => {
    if (!data) return []
    // Groups keep the net-worth category colors; accounts get distinct
    // theme-derived colors; Misc / Other stay neutral
    const banded = data.layers.filter((l) => l.key !== "misc")
    const colors = distinctBandColors(theme.primary, banded.length)
    const colorByKey = new Map(banded.map((l, i) => [l.key, colors[i]]))
    return data.layers.map((l) => {
      const category = data.mode === "category" && l.key in cats ? cats[l.key as keyof typeof cats] : null
      const color = category ? category.color
        : l.key === "misc" || l.key === "other" ? NEUTRAL_COLOR
          : colorByKey.get(l.key)!
      return { key: l.key, label: l.label, color }
    })
  }, [data, cats, theme])

  if (isError) {
    return <div className="flex items-center justify-center text-xs text-error" style={{ height }}>Failed to load breakdown</div>
  }
  if (isLoading || !data) return <div className="animate-shimmer rounded-lg" style={{ height }} />

  return (
    <div>
      <StackedAreaChart data={data.points} layers={layers} height={height} isHidden={isHidden} />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-2 pt-1">
        {[...layers].reverse().map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}

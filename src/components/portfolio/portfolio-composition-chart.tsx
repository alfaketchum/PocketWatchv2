"use client"

import { useMemo } from "react"
import { usePortfolioComposition } from "@/hooks/portfolio/use-composition"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { useNetWorthCategories } from "@/hooks/use-net-worth-colors"
import { StackedAreaChart, type StackLayer } from "@/components/ui/stacked-area-chart"
import type { CompositionMode } from "@/types/composition"

const MISC_COLOR = "#8a8f98"

interface Props {
  mode: CompositionMode
  range: string
  height: number
  isHidden: boolean
}

/** Stacked breakdown of portfolio value: Stablecoins vs Digital, or By asset. */
export function PortfolioCompositionChart({ mode, range, height, isHidden }: Props) {
  const { data, isLoading, isError } = usePortfolioComposition(mode, range)
  const theme = useChartTheme()
  const cats = useNetWorthCategories()

  const layers = useMemo<StackLayer[]>(() => {
    if (!data) return []
    let paletteIdx = 0
    return data.layers.map((l) => {
      const color = l.key === "stablecoin" ? cats.stablecoin.color
        : l.key === "digital" ? cats.digital.color
          : l.key === "misc" ? MISC_COLOR
            : theme.palette[paletteIdx++ % theme.palette.length]
      return { key: l.key, label: l.label, color }
    })
  }, [data, cats, theme])

  if (isError) {
    return <div className="flex items-center justify-center text-xs text-error" style={{ height }}>Failed to load breakdown</div>
  }
  if (isLoading || !data) return <div className="animate-shimmer rounded-lg mx-6" style={{ height }} />

  return (
    <div className="px-2 pb-3">
      <StackedAreaChart data={data.points} layers={layers} height={height} isHidden={isHidden} />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 pt-1">
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

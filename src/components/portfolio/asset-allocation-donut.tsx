"use client"

import { useMemo } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { distinctBandColors } from "@/lib/chart-band-colors"
import type { AggregatedAsset } from "@/lib/portfolio/aggregated-assets"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { AllocationDonut, type AllocationSlice } from "@/components/portfolio/allocation-donut"

interface AssetAllocationDonutProps {
  assets: readonly AggregatedAsset[]
  iconMap: Record<string, string>
  totalValue: number
  isHidden?: boolean
}

/** Biggest assets get their own slice; the rest share "Other". */
const MAX_SLICES = 9
const OTHER_COLOR = "#8a8f98"

/** What the portfolio holds, by asset (all chains combined). */
export function AssetAllocationDonut({ assets, iconMap, totalValue, isHidden }: AssetAllocationDonutProps) {
  const { primary } = useChartTheme()
  const slices = useMemo<AllocationSlice[]>(() => {
    const held = assets.filter((a) => a.totalValue > 0)
    const top = held.slice(0, MAX_SLICES)
    const rest = held.slice(MAX_SLICES).reduce((s, a) => s + a.totalValue, 0)
    const colors = distinctBandColors(primary, top.length)
    const named = top.map((a, i) => ({
      key: a.symbol,
      label: a.symbol,
      value: a.totalValue,
      color: colors[i],
      icon: <PortfolioAssetIcon asset={a.symbol} iconUrl={iconMap[a.symbol] ?? iconMap[a.symbol.toLowerCase()]} size={16} showChainBadge={false} />,
    }))
    const others = held.length - top.length
    return rest > 0 ? [...named, { key: "__other", label: `Other (${others})`, value: rest, color: OTHER_COLOR }] : named
  }, [assets, iconMap, primary])

  const count = assets.filter((a) => a.totalValue > 0).length
  const caption = `${count} ${count === 1 ? "asset" : "assets"}`
  return <AllocationDonut title="Asset allocation" slices={slices} totalValue={totalValue} caption={caption} isHidden={isHidden} />
}

"use client"

import { useMemo } from "react"
import { useNetWorthCategories, NW_STACK_ORDER } from "@/hooks/use-net-worth-colors"
import { StackedAreaChart } from "@/components/ui/stacked-area-chart"

export interface StackPoint {
  date: string
  cash: number
  savings: number
  investment: number
  stablecoin: number
  digital: number
}

export type StackKey = "cash" | "savings" | "investment" | "stablecoin" | "digital"

interface Props {
  data: StackPoint[]
  height?: number
  onDrill?: (key: StackKey) => void
}

/** Stacked-area net-worth chart: asset categories stacked to the total, with a
 *  clickable legend that drills into a single category. */
export function NetWorthStackedChart({ data, height = 280, onDrill }: Props) {
  const cats = useNetWorthCategories()
  const layers = NW_STACK_ORDER.map((k) => cats[k])
  const points = useMemo(
    () => data.map((d) => ({ t: new Date(d.date).getTime(), values: d as unknown as Record<string, number> })),
    [data],
  )
  return (
    <StackedAreaChart
      data={points}
      layers={layers}
      height={height}
      onLayerClick={onDrill ? (key) => onDrill(key as StackKey) : undefined}
    />
  )
}

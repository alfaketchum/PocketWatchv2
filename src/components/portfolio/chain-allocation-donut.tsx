"use client"

import { useMemo } from "react"
import { ChainIcon } from "@/components/portfolio/chain-icon"
import { getChainMeta, getChainColor } from "@/lib/portfolio/chains"
import { AllocationDonut, type AllocationSlice } from "@/components/portfolio/allocation-donut"

interface ChainAllocationDonutProps {
  locations: Record<string, number | string>
  totalValue: number
  isHidden?: boolean
}

const FALLBACK_COLOR = "#86868B"
/** Dust chains below this aren't shown */
const MIN_CHAIN_USD = 5

/** Where the portfolio sits, by chain / ecosystem. */
export function ChainAllocationDonut({ locations, totalValue, isHidden }: ChainAllocationDonutProps) {
  const slices = useMemo<AllocationSlice[]>(() => {
    if (!locations || totalValue <= 0) return []
    return Object.entries(locations)
      .map(([key, val]) => ({ key, value: typeof val === "string" ? parseFloat(val) || 0 : val }))
      .filter((s) => s.value >= MIN_CHAIN_USD)
      .sort((a, b) => b.value - a.value)
      .map((s) => {
        const meta = getChainMeta(s.key)
        return {
          key: s.key,
          label: meta?.name || s.key,
          value: s.value,
          color: getChainColor(s.key) || FALLBACK_COLOR,
          icon: meta ? <ChainIcon chainId={s.key} size={16} /> : undefined,
        }
      })
  }, [locations, totalValue])

  const caption = `${slices.length} ${slices.length === 1 ? "chain" : "chains"}`
  return <AllocationDonut title="Ecosystem allocation" slices={slices} totalValue={totalValue} caption={caption} isHidden={isHidden} />
}

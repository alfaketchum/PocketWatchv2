"use client"

import { useMemo, useState } from "react"
import { ChainIcon } from "@/components/portfolio/chain-icon"
import { getChainMeta, getChainColor, hexToRgba } from "@/lib/portfolio/chains"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"

interface ChainAllocationDonutProps {
  locations: Record<string, number | string>
  totalValue: number
  isHidden?: boolean
}

interface ChainSegment {
  key: string
  label: string
  value: number
  percentage: number
  color: string
  hasIcon: boolean
}

const SIZE = 168
const RADIUS = 64
const STROKE = 18
const ACTIVE_GROW = 4
/** Gap between slices, in px along the ring */
const GAP = 2
/** Smallest arc drawn, so tiny chains stay visible and hoverable */
const MIN_ARC = 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const FALLBACK_COLOR = "#86868B"

const fmtCenter = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 })

function useSegments(locations: Record<string, number | string>, totalValue: number): ChainSegment[] {
  return useMemo(() => {
    if (!locations || totalValue <= 0) return []
    return Object.entries(locations)
      .map(([key, val]) => ({ key, value: typeof val === "string" ? parseFloat(val) || 0 : val }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((s) => {
        const meta = getChainMeta(s.key)
        return {
          key: s.key,
          label: meta?.name || s.key,
          value: s.value,
          percentage: (s.value / totalValue) * 100,
          color: getChainColor(s.key) || FALLBACK_COLOR,
          hasIcon: !!meta,
        }
      })
  }, [locations, totalValue])
}

/** Arc length and start offset for each slice around the ring. */
function arcs(segments: ChainSegment[]): Array<{ length: number; offset: number }> {
  const sum = segments.reduce((s, seg) => s + seg.value, 0)
  const gap = segments.length > 1 ? GAP : 0
  let offset = 0
  return segments.map((seg) => {
    const share = sum > 0 ? (seg.value / sum) * CIRCUMFERENCE : 0
    const length = Math.max(MIN_ARC, share - gap)
    const arc = { length, offset }
    offset += share
    return arc
  })
}

function Donut({ segments, active, onActive, isHidden, totalValue }: {
  segments: ChainSegment[]
  active: string | null
  onActive: (key: string | null) => void
  isHidden?: boolean
  totalValue: number
}) {
  const layout = arcs(segments)
  const current = segments.find((s) => s.key === active)
  const c = SIZE / 2
  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={c} cy={c} r={RADIUS} fill="none" stroke="var(--card-elevated)" strokeWidth={STROKE} />
        {segments.map((seg, i) => (
          <circle
            key={seg.key}
            cx={c} cy={c} r={RADIUS}
            fill="none"
            stroke={seg.color}
            strokeWidth={seg.key === active ? STROKE + ACTIVE_GROW : STROKE}
            strokeDasharray={`${layout[i].length} ${CIRCUMFERENCE - layout[i].length}`}
            strokeDashoffset={-layout[i].offset}
            opacity={active && seg.key !== active ? 0.3 : 1}
            className="cursor-default transition-[stroke-width,opacity] duration-150"
            onMouseEnter={() => onActive(seg.key)}
            onMouseLeave={() => onActive(null)}
          >
            <title>{isHidden ? seg.label : `${seg.label}: ${formatFiatValue(seg.value)} (${seg.percentage.toFixed(1)}%)`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
        <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted truncate max-w-full">
          {current ? current.label : `${segments.length} ${segments.length === 1 ? "chain" : "chains"}`}
        </span>
        <BlurredValue isHidden={!!isHidden}>
          <span className="font-data text-base font-semibold tabular-nums text-foreground">
            {fmtCenter(current ? current.value : totalValue)}
          </span>
        </BlurredValue>
        {current && <span className="font-data text-[11px] tabular-nums text-foreground-muted">{current.percentage.toFixed(1)}%</span>}
      </div>
    </div>
  )
}

function LegendRow({ seg, active, onActive, isHidden }: {
  seg: ChainSegment
  active: string | null
  onActive: (key: string | null) => void
  isHidden?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-opacity"
      style={{ opacity: active && seg.key !== active ? 0.45 : 1 }}
      onMouseEnter={() => onActive(seg.key)}
      onMouseLeave={() => onActive(null)}
    >
      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
      <span className="flex-shrink-0 w-4 flex items-center justify-center">
        {seg.hasIcon && <ChainIcon chainId={seg.key} size={16} />}
      </span>
      <span className="min-w-0 flex-1 truncate font-data text-[11px] font-medium text-foreground">{seg.label}</span>
      <BlurredValue isHidden={!!isHidden}>
        <span className="whitespace-nowrap font-data text-[11px] tabular-nums text-foreground-muted">{formatFiatValue(seg.value)}</span>
      </BlurredValue>
      <span
        className="w-12 text-right whitespace-nowrap font-data text-[10px] tabular-nums"
        style={{ color: seg.percentage >= 1 ? hexToRgba(seg.color, 0.85) : "var(--foreground-muted)" }}
      >
        {seg.percentage.toFixed(1)}%
      </span>
    </div>
  )
}

/** Where the portfolio sits, by chain: a donut with a hoverable legend. */
export function ChainAllocationDonut({ locations, totalValue, isHidden }: ChainAllocationDonutProps) {
  const segments = useSegments(locations, totalValue)
  const [active, setActive] = useState<string | null>(null)
  if (segments.length === 0) return null

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <p className="text-xs font-medium text-foreground-muted mb-4">Allocation</p>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <Donut segments={segments} active={active} onActive={setActive} isHidden={isHidden} totalValue={totalValue} />
        <div className="grid w-full min-w-0 max-w-3xl flex-1 grid-cols-1 gap-x-8 gap-y-0.5 md:grid-cols-2">
          {segments.map((seg) => (
            <LegendRow key={seg.key} seg={seg} active={active} onActive={setActive} isHidden={isHidden} />
          ))}
        </div>
      </div>
    </div>
  )
}

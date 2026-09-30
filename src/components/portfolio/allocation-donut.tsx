"use client"

import { useState, type ReactNode } from "react"
import { hexToRgba } from "@/lib/portfolio/chains"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"

export interface AllocationSlice {
  key: string
  label: string
  value: number
  color: string
  icon?: ReactNode
}

interface AllocationDonutProps {
  title: string
  slices: AllocationSlice[]
  /** Shown in the center when nothing is hovered */
  totalValue: number
  /** Center caption, e.g. "8 chains" */
  caption: string
  isHidden?: boolean
}

const SIZE = 168
const RADIUS = 64
const STROKE = 18
const ACTIVE_GROW = 4
/** Gap between slices, in px along the ring */
const GAP = 2
/** Smallest arc drawn, so tiny slices stay visible and hoverable */
const MIN_ARC = 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const fmtCenter = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 })

/** Arc length and start offset for each slice around the ring. */
function arcs(slices: AllocationSlice[]): Array<{ length: number; offset: number }> {
  const sum = slices.reduce((s, slice) => s + slice.value, 0)
  const gap = slices.length > 1 ? GAP : 0
  let offset = 0
  return slices.map((slice) => {
    const share = sum > 0 ? (slice.value / sum) * CIRCUMFERENCE : 0
    const arc = { length: Math.max(MIN_ARC, share - gap), offset }
    offset += share
    return arc
  })
}

interface RingProps {
  slices: AllocationSlice[]
  sum: number
  active: string | null
  onActive: (key: string | null) => void
  totalValue: number
  caption: string
  isHidden?: boolean
}

function Ring({ slices, sum, active, onActive, totalValue, caption, isHidden }: RingProps) {
  const layout = arcs(slices)
  const current = slices.find((s) => s.key === active)
  const c = SIZE / 2
  const pct = (v: number) => (sum > 0 ? (v / sum) * 100 : 0)
  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={c} cy={c} r={RADIUS} fill="none" stroke="var(--card-elevated)" strokeWidth={STROKE} />
        {slices.map((slice, i) => (
          <circle
            key={slice.key}
            cx={c} cy={c} r={RADIUS}
            fill="none"
            stroke={slice.color}
            strokeWidth={slice.key === active ? STROKE + ACTIVE_GROW : STROKE}
            strokeDasharray={`${layout[i].length} ${CIRCUMFERENCE - layout[i].length}`}
            strokeDashoffset={-layout[i].offset}
            opacity={active && slice.key !== active ? 0.3 : 1}
            className="cursor-default transition-[stroke-width,opacity] duration-150"
            onMouseEnter={() => onActive(slice.key)}
            onMouseLeave={() => onActive(null)}
          >
            <title>{isHidden ? slice.label : `${slice.label}: ${formatFiatValue(slice.value)} (${pct(slice.value).toFixed(1)}%)`}</title>
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
        <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted truncate max-w-full">
          {current ? current.label : caption}
        </span>
        <BlurredValue isHidden={!!isHidden}>
          <span className="font-data text-base font-semibold tabular-nums text-foreground">
            {fmtCenter(current ? current.value : totalValue)}
          </span>
        </BlurredValue>
        {current && <span className="font-data text-[11px] tabular-nums text-foreground-muted">{pct(current.value).toFixed(1)}%</span>}
      </div>
    </div>
  )
}

function LegendRow({ slice, percentage, active, onActive, isHidden }: {
  slice: AllocationSlice
  percentage: number
  active: string | null
  onActive: (key: string | null) => void
  isHidden?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-opacity"
      style={{ opacity: active && slice.key !== active ? 0.45 : 1 }}
      onMouseEnter={() => onActive(slice.key)}
      onMouseLeave={() => onActive(null)}
    >
      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
      <span className="flex-shrink-0 w-4 flex items-center justify-center">{slice.icon}</span>
      <span className="min-w-0 flex-1 truncate font-data text-[11px] font-medium text-foreground">{slice.label}</span>
      <BlurredValue isHidden={!!isHidden}>
        <span className="whitespace-nowrap font-data text-[11px] tabular-nums text-foreground-muted">{formatFiatValue(slice.value)}</span>
      </BlurredValue>
      <span
        className="w-12 text-right whitespace-nowrap font-data text-[10px] tabular-nums"
        style={{ color: percentage >= 1 ? hexToRgba(slice.color, 0.85) : "var(--foreground-muted)" }}
      >
        {percentage.toFixed(1)}%
      </span>
    </div>
  )
}

/** A donut with a hoverable legend; hovering either one highlights the slice and shows it in the center. */
export function AllocationDonut({ title, slices, totalValue, caption, isHidden }: AllocationDonutProps) {
  const [active, setActive] = useState<string | null>(null)
  if (slices.length === 0) return null
  const sum = slices.reduce((s, slice) => s + slice.value, 0)

  return (
    <div className="h-full bg-card border border-card-border rounded-xl p-5">
      <p className="text-xs font-medium text-foreground-muted mb-4">{title}</p>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <Ring slices={slices} sum={sum} active={active} onActive={setActive} totalValue={totalValue} caption={caption} isHidden={isHidden} />
        <div className="w-full min-w-0 flex-1 space-y-0.5">
          {slices.map((slice) => (
            <LegendRow
              key={slice.key}
              slice={slice}
              percentage={sum > 0 ? (slice.value / sum) * 100 : 0}
              active={active}
              onActive={setActive}
              isHidden={isHidden}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

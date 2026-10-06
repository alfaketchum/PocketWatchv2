"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { histogram, sameSlice, type EndingMeasure, type HistogramBin, type HistogramSlice } from "@/lib/plans/stress/stress-histogram"
import type { OutcomeKey, OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"
import { useOutcomeColors } from "./use-outcome-colors"

const HEIGHT = 240
/** Stacked bottom to top: worst outcomes at the base, so failures read first. */
const STACK: OutcomeKey[] = ["catastrophic", "almostSurvived", "soldHome", "justMadeIt", "steady", "surplus"]
const LABELS: Record<OutcomeKey, string> = {
  surplus: "Surplus",
  steady: "Steady",
  justMadeIt: "Just made it",
  soldHome: "Sold the home",
  almostSurvived: "Almost survived",
  catastrophic: "Catastrophic",
}

type Row = HistogramBin & Record<OutcomeKey, number> & { label: string }

/** "ran out", "under $9M", "$9M – $15M" or "$120M+". */
export function sliceLabel(s: HistogramSlice): string {
  if (s.kind === "ranOut") return "ran out"
  const what = s.measure === "invested" ? " in accounts" : " net worth"
  if (s.from === -Infinity) return `ended with under ${fmtCompact(s.to)}${what}`
  if (s.to === Infinity) return `ended with ${fmtCompact(s.from)}+${what}`
  return `ended with ${fmtCompact(s.from)} – ${fmtCompact(s.to)}${what}`
}

const axisLabel = (s: HistogramSlice) => (s.kind === "ranOut" ? "Ran out" : s.from === -Infinity ? `<${fmtCompact(s.to)}` : fmtCompact(s.from))

function BinTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload: Row }>; total: number }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  return (
    <div className="space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{sliceLabel(r.slice).replace(/^./, (c) => c.toUpperCase())}</p>
      <p className="text-foreground-muted">
        {r.count} of {total} trials ({Math.round((r.count / Math.max(1, total)) * 100)}%)
      </p>
      {STACK.filter((k) => r.byOutcome[k] > 0)
        .reverse()
        .map((k) => (
          <p key={k} className="flex justify-between gap-4 text-foreground-muted">
            <span>{LABELS[k]}</span>
            <span className="tabular-nums">{r.byOutcome[k]}</span>
          </p>
        ))}
      <p className="pt-0.5 text-[10px] text-foreground-muted">Click to show only these trials</p>
    </div>
  )
}

interface Props {
  cohorts: CohortResult[]
  yardsticks: OutcomeYardsticks
  measure: EndingMeasure
  /** The selected bar, or null. */
  selected: HistogramSlice | null
  onSelect: (slice: HistogramSlice | null) => void
  isHidden: boolean
}

/**
 * How many trials ran out, and how many ended at each level of net worth (today's dollars), colored by outcome;
 * click a bar to filter.
 */
export function StressHistogramChart({ cohorts, yardsticks, measure, selected, onSelect, isHidden }: Props) {
  const { foregroundMuted, border, foreground } = useChartTheme()
  const colors = useOutcomeColors()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 40
  const data = useMemo<Row[]>(
    () => histogram(cohorts, yardsticks, measure).map((b) => ({ ...b, ...b.byOutcome, label: axisLabel(b.slice) })),
    [cohorts, yardsticks, measure],
  )
  const isSelected = (r: Row) => !!selected && sameSlice(r.slice, selected)
  const select = (r: Row) => onSelect(isSelected(r) ? null : r.slice)
  return (
    <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap={2}>
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={axisWidth} />
          <Tooltip content={<BinTooltip total={cohorts.length} />} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
          {STACK.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="outcome"
              fill={colors[key]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry: { payload?: Row }) => entry.payload && select(entry.payload)}
            >
              {data.map((r) => (
                <Cell key={r.key} fillOpacity={!selected || isSelected(r) ? 0.9 : 0.25} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

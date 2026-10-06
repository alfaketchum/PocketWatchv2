"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { mix } from "@/components/plans/results/use-plan-colors"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { histogram, sameSlice, type EndingMeasure, type HistogramBin, type HistogramSlice } from "@/lib/plans/stress/stress-histogram"
import type { OutcomeKey, OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"
import { useOutcomeColors } from "./use-outcome-colors"

const HEIGHT = 240
/** Stacked bottom to top: worst outcomes at the base, so failures read first. */
const STACK: OutcomeKey[] = ["catastrophic", "almostSurvived", "outOfCash", "soldHome", "justMadeIt", "steady", "surplus"]
const LABELS: Record<OutcomeKey, string> = {
  surplus: "Surplus",
  steady: "Steady",
  justMadeIt: "Just made it",
  soldHome: "Sold the home",
  outOfCash: "Out of cash",
  almostSurvived: "Almost survived",
  catastrophic: "Catastrophic",
}

/** The net worth view stacks each bar by what its trials' net worth is made of, split by trial count. */
type WorthKey = "inAccounts" | "inProperty"
const WORTH_LABELS: Record<WorthKey, string> = { inAccounts: "Money in accounts", inProperty: "Home & property" }

type Row = HistogramBin & Record<OutcomeKey, number> & Record<WorthKey, number> & { label: string }

/** A bar's trial count split by its accounts' share of net worth (all accounts when there's nothing). */
function worthSplit(b: HistogramBin): Record<WorthKey, number> {
  const total = b.accounts + b.property
  const share = total > 0 ? b.accounts / total : 1
  return { inAccounts: b.count * share, inProperty: b.count * (1 - share) }
}

/** "ran out", "under $9M", "$9M – $15M" or "$120M+". */
export function sliceLabel(s: HistogramSlice): string {
  if (s.kind === "ranOut") return "ran out"
  const what = s.measure === "invested" ? " in accounts" : " net worth"
  if (s.from === -Infinity) return `ended with under ${fmtCompact(s.to)}${what}`
  if (s.to === Infinity) return `ended with ${fmtCompact(s.from)}+${what}`
  return `ended with ${fmtCompact(s.from)} – ${fmtCompact(s.to)}${what}`
}

const axisLabel = (s: HistogramSlice) => (s.kind === "ranOut" ? "Ran out" : s.from === -Infinity ? `<${fmtCompact(s.to)}` : fmtCompact(s.from))

/** Average money in accounts and home and property per trial in the bar, with each one's share. */
function WorthLines({ r }: { r: Row }) {
  const total = r.accounts + r.property
  const line = (label: string, value: number) => (
    <p className="flex justify-between gap-4 text-foreground-muted">
      <span>{label}</span>
      <span className="tabular-nums">
        {fmtMoney(value / Math.max(1, r.count))} · {total > 0 ? fmtPct(value / total, 0) : "—"}
      </span>
    </p>
  )
  return (
    <>
      {line(WORTH_LABELS.inAccounts, r.accounts)}
      {line(WORTH_LABELS.inProperty, r.property)}
      <p className="text-[10px] text-foreground-muted">Average per trial</p>
    </>
  )
}

function BinTooltip({ active, payload, total, worth }: { active?: boolean; payload?: Array<{ payload: Row }>; total: number; worth: boolean }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  return (
    <div className="space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{sliceLabel(r.slice).replace(/^./, (c) => c.toUpperCase())}</p>
      <p className="text-foreground-muted">
        {r.count} of {total} trials ({Math.round((r.count / Math.max(1, total)) * 100)}%)
      </p>
      {worth ? (
        <WorthLines r={r} />
      ) : (
        STACK.filter((k) => r.byOutcome[k] > 0)
          .reverse()
          .map((k) => (
            <p key={k} className="flex justify-between gap-4 text-foreground-muted">
              <span>{LABELS[k]}</span>
              <span className="tabular-nums">{r.byOutcome[k]}</span>
            </p>
          ))
      )}
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
 * How many trials ran out, and how many ended at each level of money in accounts (colored by outcome) or net worth
 * (split into money in accounts vs home and property), today's dollars; click a bar to filter.
 */
export function StressHistogramChart({ cohorts, yardsticks, measure, selected, onSelect, isHidden }: Props) {
  const { foregroundMuted, border, foreground, primary, card } = useChartTheme()
  const colors = useOutcomeColors()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 40
  const worth = measure === "netWorth"
  const data = useMemo<Row[]>(
    () => histogram(cohorts, yardsticks, measure).map((b) => ({ ...b, ...b.byOutcome, ...worthSplit(b), label: axisLabel(b.slice) })),
    [cohorts, yardsticks, measure],
  )
  const stack: { key: OutcomeKey | WorthKey; fill: string }[] = worth
    ? [
        { key: "inAccounts", fill: primary },
        { key: "inProperty", fill: mix(foregroundMuted, card, 0.6) },
      ]
    : STACK.map((key) => ({ key, fill: colors[key] }))
  const isSelected = (r: Row) => !!selected && sameSlice(r.slice, selected)
  const select = (r: Row) => onSelect(isSelected(r) ? null : r.slice)
  return (
    <div>
      <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap={2}>
            <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={axisWidth} />
            <Tooltip content={<BinTooltip total={cohorts.length} worth={worth} />} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
            {stack.map(({ key, fill }) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="ending"
                fill={fill}
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
      {worth && (
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-foreground-muted">
          {stack.map(({ key, fill }) => (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: fill }} /> {WORTH_LABELS[key as WorthKey]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

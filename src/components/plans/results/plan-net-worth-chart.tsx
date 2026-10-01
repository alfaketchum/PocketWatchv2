"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { cn } from "@/lib/utils"
import { chartMilestones, milestoneGroup, type ChartMilestone } from "@/lib/plans/plan-chart"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { milestoneUses } from "@/lib/plans/plan-milestone-uses"
import { yearMetrics } from "@/lib/plans/plan-year-metrics"
import { ChartPlot, ICON_ROW, ICON_STACK, MILESTONE_ICONS, type HoveredMark } from "./plan-chart-plot"
import { PlanYearPanel } from "./plan-year-panel"
import { useChartSeries, type ChartMode, type ChartRow, type Series } from "./use-chart-series"
import { usePlanColors } from "./use-plan-colors"
import { useSteadySpending } from "./use-steady-spending"
import { SpendingImpactChart } from "./spending-impact-chart"

const Y_HEADROOM = 1.03
/** Stack position of each milestone among those in the same year (0 = lowest). */
function stackMarks(marks: ChartMilestone[]): { mark: ChartMilestone; level: number }[] {
  const seen = new Map<number, number>()
  return marks.map((mark) => {
    const level = seen.get(mark.age) ?? 0
    seen.set(mark.age, level + 1)
    return { mark, level }
  })
}
const MODES: { value: ChartMode; label: string }[] = [
  { value: "networth", label: "Net worth" },
  { value: "cashflow", label: "Cash flow" },
  { value: "expenses", label: "Expenses" },
  { value: "debt", label: "Debt" },
]

const EYEBROW: Record<ChartMode, string> = { networth: "Net worth", cashflow: "Cash flow", expenses: "Expenses", debt: "Debt" }

const INFO: Record<ChartMode, string> = {
  networth:
    "Year-end balances by tax treatment, plus property (homes, cars, other assets) at what it's worth. Every debt, mortgages and car loans included, shows below zero; net worth is the dot. Hover a bar to see that year; click to pin it.",
  cashflow:
    "Money in above zero (income, withdrawals by account type, asset sales) and where it went below zero (spending, taxes, debt, purchases, savings). The two sides balance every year. Employer match is left out.",
  expenses:
    "Everything spent each year: living costs, kids, running a home or car, taxes and debt payments, on their own scale. Turn on Subcategories for every spending line and kind of tax; spending that changes with age shows here. When lines have spending patterns, the dashed line is the same plan with every line steady.",
  debt: "What you pay on your loans each year, split into principal (paying the loan down) and interest (the cost of borrowing); Subcategories splits it per loan. The dashed line is what's still owed at year end (right axis): it shrinks with the payments and drops to zero early if what a loan is for is sold.",
}

/** Remembered per browser: whether the chart shows subcategories. */
const DETAIL_KEY = "pw-plan-chart-detail"

function readDetail(): boolean {
  try {
    return localStorage.getItem(DETAIL_KEY) === "1"
  } catch {
    return false
  }
}

/** Right-aligned switch: split each band into its accounts, assets, loans, incomes, spending lines… */
function DetailToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[11px] font-medium text-foreground-muted hover:text-foreground"
    >
      Subcategories
      <span className={cn("relative inline-block h-4 w-7 rounded-full transition-colors", checked ? "bg-primary" : "bg-foreground/15")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", checked ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  )
}

function ModeToggle({ value, onChange, modes }: { value: ChartMode; onChange: (mode: ChartMode) => void; modes: ChartMode[] }) {
  return (
    <div role="radiogroup" aria-label="Chart view" className="inline-flex rounded-lg border border-card-border p-0.5">
      {MODES.filter((m) => modes.includes(m.value)).map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === m.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

const TICK_INTERVALS = 6
/** Room below zero, relative to the deepest negative bar, when that's less than a tick step. */
const NEG_ROOM = 1.25

/** 1, 2, 2.5 or 5 × a power of ten: a round step near `raw`. */
function roundStep(raw: number): number {
  if (raw <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10
  return step * magnitude
}

/** Round ticks that hug the stacked bars, so the tallest one nearly fills the plot. */
function fitAxis(rows: ChartRow[], series: Series[], atLeast = 0): { domain: [number, number]; ticks: number[] } {
  let top = atLeast
  let bottom = 0
  for (const row of rows) {
    const values = series.map((s) => row[s.key] ?? 0)
    top = Math.max(
      top,
      values.reduce((sum, v) => sum + Math.max(0, v), 0),
    )
    bottom = Math.min(
      bottom,
      values.reduce((sum, v) => sum + Math.min(0, v), 0),
    )
  }
  const step = roundStep(((top - bottom) * Y_HEADROOM) / TICK_INTERVALS)
  const hi = Math.ceil((top * Y_HEADROOM) / step) * step
  // Below zero, room for what's there (not a whole step for a small loan); ticks stay on round steps.
  const stepped = -step * Math.ceil((-bottom * Y_HEADROOM) / step)
  const lo = bottom >= 0 ? 0 : Math.max(stepped, bottom * NEG_ROOM)
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step / 2; t += step) ticks.push(Math.round(t))
  return { domain: [lo, hi], ticks }
}

/** What to say under a milestone's name: what's tied to it, or where it comes from. */
function milestoneSubtext(mark: ChartMilestone, doc: PlanDocument): string {
  if (mark.kind === "depleted") return "Your accounts can't cover spending from this year on."
  if (mark.kind === "child") return "From Kids · edit on Expenses → Kids"
  if (mark.kind === "asset") return "From Assets & debts · edit it there"
  if (mark.kind === "income") return "From Income · edit it there"
  if (mark.kind === "payoff") return "Last payment on this loan · change it on Assets & debts"
  const uses = milestoneUses(doc, mark.id)
  return uses.length > 0 ? `Used by: ${uses.join(" · ")}` : "Nothing is tied to it yet"
}

/** Hover card for a milestone icon, placed just below the icon. */
function MilestoneCard({ hovered, doc }: { hovered: HoveredMark; doc: PlanDocument }) {
  const { mark, x, y } = hovered
  return (
    <div
      className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: x, top: y + 16 }}
    >
      <p className="font-semibold text-foreground">{mark.name}</p>
      <p className="text-foreground-muted">
        {mark.year} · age {mark.age}
      </p>
      <p className="mt-1 text-[11px] text-foreground-muted">{milestoneSubtext(mark, doc)}</p>
    </div>
  )
}

/** Still-owed line for the Debt view: drawn down to zero at a payoff, then left out while nothing is owed. */
function withOwedLine(points: ChartRow[]): ChartRow[] {
  return points.map((p, i) => {
    const owedNow = (p.owed ?? 0) > 0.5
    const owedBefore = i > 0 && (points[i - 1].owed ?? 0) > 0.5
    // Without a value recharts leaves a gap instead of a flat line along zero.
    return owedNow || owedBefore ? { ...p, owedLine: p.owed } : p
  })
}

interface Props {
  doc: PlanDocument
  projection: PlanProjection
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
}

/**
 * One stacked bar per plan year: net worth by tax treatment (with homes and other assets, and debt below zero), or
 * cash flow in and out. Hover a bar for that year's P&L panel; click to pin it.
 */
export const PlanNetWorthChart = memo(function PlanNetWorthChart({ doc, projection, rows, basis, isHidden }: Props) {
  const [mode, setMode] = useState<ChartMode>("networth")
  const [detail, setDetailState] = useState(false)
  useEffect(() => setDetailState(readDetail()), [])
  const setDetail = useCallback((on: boolean) => {
    setDetailState(on)
    try {
      localStorage.setItem(DETAIL_KEY, on ? "1" : "0")
    } catch {
      /* private mode: stays for this visit */
    }
  }, [])
  const marks = useMemo(() => chartMilestones(doc, projection), [doc, projection])
  const stacked = useMemo(() => stackMarks(marks), [marks])
  const [hoveredMark, setHoveredMark] = useState<HoveredMark | null>(null)
  // Colored by what a milestone is about: work life, family, money in, property, other changes, trouble.
  const { milestones: groupColors } = usePlanColors()
  const markColor = useCallback((m: ChartMilestone) => groupColors[milestoneGroup(m)], [groupColors])
  const iconRoom = ICON_ROW + Math.max(0, ...stacked.map((s) => s.level)) * ICON_STACK
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  /** Bar isolation mode: one year fills the chart. Double-click a bar to enter; Back, Esc or a double-click outside leaves. */
  const [isolated, setIsolatedState] = useState<number | null>(null)
  /** Kept in step with `isolated` at once: a late click event must see isolation the moment it starts. */
  const isolatedRef = useRef<number | null>(null)
  const setIsolated = useCallback((index: number | null) => {
    isolatedRef.current = index
    setIsolatedState(index)
  }, [])
  const plotArea = useRef<HTMLDivElement>(null)
  /** The bar under the pointer, kept in a ref so a fast double-click reads it before the hover state re-renders. */
  const hoveredRef = useRef<number | null>(null)
  /** The bar last clicked or tapped: touch has no hover, and a double-tap is two taps on the same bar. */
  const clickedRef = useRef<number | null>(null)
  const isolate = useCallback(() => {
    const index = hoveredRef.current ?? clickedRef.current
    if (index === null) return
    // A double-click is two clicks first, which toggle the pin on and off again: pin the year here for good.
    setSelected(index)
    setIsolated(index)
  }, [setIsolated])
  const leaveIsolation = useCallback(() => setIsolated(null), [setIsolated])
  useEffect(() => {
    if (isolated === null) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leaveIsolation()
    const onDouble = (e: MouseEvent) => {
      if (!plotArea.current?.contains(e.target as Node)) leaveIsolation()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("dblclick", onDouble)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("dblclick", onDouble)
    }
  }, [isolated, leaveIsolation])
  const { view, points, series, nwPoints, hasDebt } = useChartSeries(doc, rows, mode, detail)
  const { netWorth: nwColors } = usePlanColors()
  // Expenses view: the dashed line is the same plan with every spending line steady.
  const steady = useSteadySpending(doc, basis, view === "expenses")
  const plotPoints = useMemo(() => {
    if (steady) return points.map((p, i) => ({ ...p, steady: steady[i] ?? 0 }))
    if (view === "debt") return withOwedLine(points)
    return points
  }, [points, steady, view])
  // Isolated: just that year, its axis fitted to it alone so the bar fills the chart.
  const shownPoints = useMemo(
    () => (isolated === null || !plotPoints[isolated] ? plotPoints : plotPoints.slice(isolated, isolated + 1)),
    [plotPoints, isolated],
  )
  const shownMarks = useMemo(
    () => (isolated === null ? stacked : stacked.filter((s) => s.mark.age === plotPoints[isolated]?.age)),
    [stacked, isolated, plotPoints],
  )
  const yAxis = useMemo(
    () => fitAxis(shownPoints, series, steady && isolated === null ? Math.max(0, ...steady) : 0),
    [shownPoints, series, steady, isolated],
  )
  // While isolated the plot holds one bar (index 0); map its hover and clicks back to the real year.
  const onPlotHover = useCallback(
    (i: number | null) => {
      const year = i === null || isolated === null ? i : isolated
      hoveredRef.current = year
      setHovered(year)
    },
    [isolated],
  )
  const toggleSelected = useCallback(
    (index: number) => {
      // While isolated the plot has one bar, so its click index isn't a plan year: ignore it.
      if (isolatedRef.current !== null) return
      clickedRef.current = index
      setSelected((cur) => (cur === index ? null : index))
    },
    [],
  )
  const active = selected ?? hovered ?? 0
  const activePoint = nwPoints[active] ?? null
  const metrics = useMemo(
    () => yearMetrics(doc, rows, active, projection.startNetWorth),
    [doc, rows, active, projection.startNetWorth],
  )

  return (
    <FireSectionCard
      eyebrow={EYEBROW[view]}
      title={basis === "today" ? "In today's dollars" : "In future dollars"}
      info={INFO[view]}
      center={<ModeToggle value={view} onChange={setMode} modes={hasDebt ? ["networth", "cashflow", "expenses", "debt"] : ["networth", "cashflow", "expenses"]} />}
      right={<DetailToggle checked={detail} onChange={setDetail} />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <div
            ref={plotArea}
            onDoubleClick={isolated === null ? isolate : undefined}
            className="relative h-[340px] select-none lg:h-[500px]"
            style={{ filter: isHidden ? "blur(8px)" : undefined }}
          >
            {hoveredMark && <MilestoneCard hovered={hoveredMark} doc={doc} />}
            {isolated !== null && (
              <button
                type="button"
                onClick={leaveIsolation}
                className="absolute left-16 top-1 z-10 inline-flex items-center gap-1 rounded-lg border border-card-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-foreground/5"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
                  arrow_back
                </span>
                All years
              </button>
            )}
            <ChartPlot
              points={shownPoints}
              series={series}
              yAxis={yAxis}
              iconRoom={iconRoom}
              stacked={shownMarks}
              mode={view}
              hasDebt={hasDebt}
              showSteady={steady !== null && isolated === null}
              selected={isolated === null ? selected : 0}
              markColor={markColor}
              onHover={onPlotHover}
              onSelect={toggleSelected}
              onHoverMark={setHoveredMark}
              isolated={isolated !== null}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            {view === "debt" && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                <span className="w-3 border-t-[1.5px] border-dashed border-foreground/60" />
                Still owed (right axis)
              </span>
            )}
            {steady && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                <span className="w-3 border-t-[1.5px] border-dashed border-foreground/60" />
                All steady (no spending patterns)
              </span>
            )}
            {marks.map((m) => (
              <span
                key={`legend-${m.name}-${m.age}`}
                className="inline-flex items-center gap-1 text-[11px] text-foreground-muted"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 13, color: markColor(m) }}>
                  {m.icon ?? MILESTONE_ICONS[m.kind]}
                </span>
                {m.name} ({m.age})
              </span>
            ))}
          </div>
          {view === "expenses" && doc.expenses.some((e) => !e.oneTime) && (
            <div className="mt-4">
              <SpendingImpactChart doc={doc} isHidden={isHidden} />
            </div>
          )}
        </div>
        {metrics && activePoint && (
          <div className="lg:sticky lg:top-4" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            <PlanYearPanel
              metrics={metrics}
              age={activePoint.age}
              year={activePoint.year}
              pinned={selected !== null}
              onUnpin={() => setSelected(null)}
              colors={{
                cash: nwColors.cash,
                taxable: nwColors.taxable,
                taxDeferred: nwColors.taxDeferred,
                taxFree: nwColors.taxFree,
              }}
            />
          </div>
        )}
      </div>
    </FireSectionCard>
  )
})

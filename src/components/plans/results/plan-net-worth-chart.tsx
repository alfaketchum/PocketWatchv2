"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { chartMilestones, milestoneGroup, type ChartMilestone } from "@/lib/plans/plan-chart"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { yearMetrics } from "@/lib/plans/plan-year-metrics"
import { ChartPlot, ICON_ROW, ICON_STACK, type HoveredMark } from "./plan-chart-plot"
import { PlanChartLegend } from "./plan-chart-legend"
import { PlanYearPanel } from "./plan-year-panel"
import { fitAxis, stackMarks } from "./plan-chart-axis"
import { chartModes, DetailToggle, ModeToggle } from "./plan-chart-controls"
import { DollarsToggle } from "./dollars-toggle"
import { MilestoneCard } from "./plan-milestone-card"
import { useChartDetail } from "./use-chart-detail"
import { useChartSeries, type ChartMode, type ChartRow } from "./use-chart-series"
import { usePlanColors } from "./use-plan-colors"
import { useSteadySpending } from "./use-steady-spending"
import { SpendingImpactChart } from "./spending-impact-chart"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { BASIC_CHART_VIEWS } from "@/lib/plans/plan-mode"

const EYEBROW: Record<ChartMode, string> = { networth: "Net worth", accounts: "Accounts", cashflow: "Cash flow", income: "Income", expenses: "Expenses", debt: "Debt", taxes: "Taxes" }

const INFO: Record<ChartMode, string> = {
  networth:
    "Year-end balances by tax treatment, plus assets (homes, cars and other things you own) at what they're worth. Every debt, mortgages and car loans included, shows below zero; net worth is the dot. Hover a bar to see that year; click to pin it.",
  accounts:
    "Each account's year-end balance, stacked: what's in your accounts and how it's split, account by account. Colors follow the tax treatment (shades of the Net worth bands). Homes and loans are left out; they have their own views. Hover a bar to see each account.",
  cashflow:
    "Money in above zero (income, withdrawals by account type, asset sales) and where it went below zero (spending, taxes, debt, purchases, savings). The two sides balance every year. Employer match is left out.",
  income:
    "Everything earned each year, before tax, by kind: work, stock pay, Social Security, pensions, rent and other income. Turn on Subcategories for each income line. Employer match is left out (it goes straight into the account).",
  expenses:
    "Everything spent each year: living costs, kids, running a home or car, taxes and debt payments, on their own scale. Turn on Subcategories for every spending line and kind of tax; spending that changes with age shows here. The dashed line is the same plan without its spending rule, or (with spending patterns and no rule) with every line steady.",
  taxes:
    "All tax paid each year. Turn on Subcategories to split it: income tax (federal and state, with the AMT and investment-income tax), payroll tax, tax on withdrawals from pre-tax accounts, tax on assets sold, and tax on trading gains.",
  debt: "What you pay on your loans each year, split into principal (paying the loan down) and interest (the cost of borrowing); Subcategories splits it per loan. The dashed line is what's still owed at year end (right axis): it shrinks with the payments and drops to zero early if what a loan is for is sold.",
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
  onBasisChange: (basis: DollarBasis) => void
  isHidden: boolean
  /** Which side of the chart the year panel sits on (wide screens). */
  panelSide?: "left" | "right"
}

/**
 * One stacked bar per plan year: net worth by tax treatment (with homes and other assets, and debt below zero), or
 * cash flow in and out. Hover a bar for that year's P&L panel; click to pin it.
 */
export const PlanNetWorthChart = memo(function PlanNetWorthChart({ doc, projection, rows, basis, onBasisChange, isHidden, panelSide = "right" }: Props) {
  const [pickedMode, setMode] = useState<ChartMode>("networth")
  const [savedDetail, setDetail] = useChartDetail()
  // Basic: Net worth, Income and Expenses, without subcategories.
  const { isBasic } = usePlanMode()
  const mode = isBasic && !BASIC_CHART_VIEWS.includes(pickedMode) ? "networth" : pickedMode
  const detail = savedDetail && !isBasic
  const marks = useMemo(() => chartMilestones(doc, projection), [doc, projection])
  const stacked = useMemo(() => stackMarks(marks), [marks])
  const [hoveredMark, setHoveredMark] = useState<HoveredMark | null>(null)
  // Colored by what a milestone is about: work life, family, money in, property, other changes, trouble.
  const { milestones: groupColors } = usePlanColors()
  const markColor = useCallback((m: ChartMilestone) => groupColors[milestoneGroup(m)], [groupColors])
  const iconRoom = ICON_ROW + Math.max(0, ...stacked.map((s) => s.level)) * ICON_STACK
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const { view, points, series, nwPoints, hasDebt } = useChartSeries(doc, rows, mode, detail)
  const { netWorth: nwColors } = usePlanColors()
  // Expenses view: the dashed line is the plan without its spending rule, or with every line steady.
  const baseline = useSteadySpending(doc, basis, view === "expenses" && !isBasic)
  const steady = baseline?.values ?? null
  const plotPoints = useMemo(() => {
    if (steady) return points.map((p, i) => ({ ...p, steady: steady[i] ?? 0 }))
    if (view === "debt") return withOwedLine(points)
    return points
  }, [points, steady, view])
  /** Year view: the pinned year alone, its bar filling the chart. Entered from the header, left with All years. */
  const [focus, setFocus] = useState<number | null>(null)
  const focused = focus !== null && plotPoints[focus] ? focus : null
  const shownPoints = useMemo(() => (focused === null ? plotPoints : plotPoints.slice(focused, focused + 1)), [plotPoints, focused])
  const shownMarks = useMemo(
    () => (focused === null ? stacked : stacked.filter((s) => s.mark.age === plotPoints[focused]?.age)),
    [stacked, focused, plotPoints],
  )
  const yAxis = useMemo(
    () => fitAxis(shownPoints, series, steady && focused === null ? Math.max(0, ...steady) : 0),
    [shownPoints, series, steady, focused],
  )
  // In the year view the plot holds one bar: hovering it means that year, and clicks leave the pin alone.
  const onPlotHover = useCallback((i: number | null) => setHovered(i === null || focused === null ? i : focused), [focused])
  const clearSelected = useCallback(() => {
    if (focused === null) setSelected(null)
  }, [focused])
  const toggleSelected = useCallback(
    (index: number) => {
      if (focused === null) setSelected((cur) => (cur === index ? null : index))
    },
    [focused],
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
      title={isBasic ? "In today's dollars" : <DollarsToggle value={basis} onChange={onBasisChange} />}
      info={INFO[view]}
      center={<ModeToggle value={view} onChange={setMode} modes={chartModes(hasDebt, isBasic)} />}
      right={
        <div className="flex items-center gap-3">
          {selected !== null && focused === null && nwPoints[selected] && (
            <button
              type="button"
              onClick={() => setFocus(selected)}
              className="inline-flex items-center gap-1 rounded-lg border border-card-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-foreground/5"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
                open_in_full
              </span>
              View {nwPoints[selected].year} alone
            </button>
          )}
          {!isBasic && view !== "accounts" && <DetailToggle checked={detail} onChange={setDetail} />}
        </div>
      }
    >
      <div className={`grid gap-4 lg:items-start ${panelSide === "left" ? "lg:grid-cols-[18rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_18rem]"}`}>
        <div className="min-w-0">
          <div className="relative h-[340px] lg:h-[500px]" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            {hoveredMark && <MilestoneCard hovered={hoveredMark} doc={doc} />}
            {focused !== null && (
              <button
                type="button"
                onClick={() => setFocus(null)}
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
              showSteady={steady !== null && focused === null}
              steadyLabel={baseline?.label}
              selected={focused === null ? selected : 0}
              markColor={markColor}
              onHover={onPlotHover}
              onSelect={toggleSelected}
              onClear={clearSelected}
              onHoverMark={setHoveredMark}
              focused={focused !== null}
            />
          </div>
          <PlanChartLegend
            series={series}
            lines={[...(view === "debt" ? ["Still owed (right axis)"] : []), ...(baseline ? [baseline.label] : [])]}
            marks={marks}
            markColor={markColor}
          />
          {!isBasic && view === "expenses" && doc.expenses.some((e) => !e.oneTime) && (
            <div className="mt-4">
              <SpendingImpactChart doc={doc} isHidden={isHidden} />
            </div>
          )}
        </div>
        {metrics && activePoint && (
          <div className={`lg:sticky lg:top-4 ${panelSide === "left" ? "lg:order-first" : ""}`} style={{ filter: isHidden ? "blur(8px)" : undefined }}>
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

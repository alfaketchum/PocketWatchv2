"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { ChartTooltip } from "@/components/finance/chart-tooltip"
import { useSpendingByCategory } from "@/hooks/use-finance"
import { cn, formatCurrency } from "@/lib/utils"
import { resolveRangeDates, getPriorRange, type BudgetRange } from "./budget-helpers"

interface BudgetPeriodComparisonProps {
  range: BudgetRange
  /** Budget per category for the current period (pro-rated for lookback windows). */
  budgets: Array<{ category: string; monthlyLimit: number }>
}

const TOP_N = 8

/** Format a YYYY-MM-DD as "Mon D". */
function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Period-over-period comparison: the current selection vs the equal-length window
 * immediately before it and vs budget, as grouped bars per category plus a delta table.
 */
export function BudgetPeriodComparison({ range, budgets }: BudgetPeriodComparisonProps) {
  const { primary, foreground, foregroundMuted, border } = useChartTheme()

  const current = useMemo(() => resolveRangeDates(range), [range])
  const prior = useMemo(() => getPriorRange(range), [range])
  const { data: curData, isLoading: curLoading } = useSpendingByCategory(current)
  const { data: priData, isLoading: priLoading } = useSpendingByCategory(prior)

  const currentLabel = range.isThisMonth ? "This month" : range.label
  const priorLabel = range.isThisMonth ? "Last month" : "Prior period"

  const rows = useMemo(() => {
    const cur = new Map((curData?.categories ?? []).map((c) => [c.category, c.total]))
    const pri = new Map((priData?.categories ?? []).map((c) => [c.category, c.total]))
    const bud = new Map(budgets.map((b) => [b.category, b.monthlyLimit]))
    const cats = [...new Set([...cur.keys(), ...pri.keys(), ...bud.keys()])]
    const all = cats
      .map((category) => ({ category, current: cur.get(category) ?? 0, prior: pri.get(category) ?? 0, budget: bud.get(category) ?? null }))
      .sort((a, b) => Math.max(b.current, b.prior, b.budget ?? 0) - Math.max(a.current, a.prior, a.budget ?? 0))
    if (all.length <= TOP_N) return all
    const rest = all.slice(TOP_N)
    return [
      ...all.slice(0, TOP_N),
      {
        category: "Other",
        current: rest.reduce((s, r) => s + r.current, 0),
        prior: rest.reduce((s, r) => s + r.prior, 0),
        budget: rest.some((r) => r.budget != null) ? rest.reduce((s, r) => s + (r.budget ?? 0), 0) : null,
      },
    ]
  }, [curData, priData, budgets])

  const budgetTotal = budgets.reduce((s, b) => s + b.monthlyLimit, 0)
  const hasBudget = budgetTotal > 0

  const curTotal = curData?.total ?? 0
  const priTotal = priData?.total ?? 0
  const delta = curTotal - priTotal
  const pct = priTotal > 0 ? (delta / priTotal) * 100 : null
  const up = delta > 0 // spending more = worse

  const isLoading = curLoading || priLoading
  const isEmpty = !isLoading && curTotal === 0 && priTotal === 0

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Period comparison</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {currentLabel} <span className="text-foreground-muted font-normal">vs</span> {priorLabel}
          </p>
          <p className="text-[11px] text-foreground-muted tabular-nums mt-0.5">
            {fmtDay(current.startDate)}–{fmtDay(current.endDate)} · {fmtDay(prior.startDate)}–{fmtDay(prior.endDate)}
          </p>
        </div>
        {!isLoading && !isEmpty && (
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(curTotal, "USD", 0)}</p>
            <p className={cn("text-[11px] font-medium tabular-nums", up ? "text-error" : "text-success")}>
              {up ? "▲" : "▼"} {formatCurrency(Math.abs(delta), "USD", 0)}{pct !== null ? ` (${up ? "+" : ""}${pct.toFixed(0)}%)` : ""} vs {formatCurrency(priTotal, "USD", 0)}
            </p>
            {hasBudget && (
              <p className={cn("text-[11px] font-medium tabular-nums", curTotal > budgetTotal ? "text-error" : "text-success")}>
                {formatCurrency(Math.abs(budgetTotal - curTotal), "USD", 0)} {curTotal > budgetTotal ? "over" : "under"} budget of {formatCurrency(budgetTotal, "USD", 0)}
              </p>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-foreground-muted">Loading comparison…</div>
      ) : isEmpty ? (
        <div className="h-[120px] flex items-center justify-center text-xs text-foreground-muted">No spending in either period.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * (hasBudget ? 52 : 40) + 30)}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap="22%">
              <CartesianGrid horizontal={false} stroke={border} strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: foregroundMuted }} width={104} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: `${primary}12` }} content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="prior" name={priorLabel} fill={foregroundMuted} fillOpacity={0.45} radius={[0, 3, 3, 0]} animationDuration={600} />
              <Bar dataKey="current" name={currentLabel} fill={primary} radius={[0, 3, 3, 0]} animationDuration={600} />
              {hasBudget && (
                <Bar dataKey="budget" name="Budget" fill="transparent" stroke={foreground} strokeOpacity={0.55} strokeDasharray="3 2" radius={[0, 3, 3, 0]} animationDuration={600} />
              )}
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto rounded-lg border border-card-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-card-elevated text-[10px] uppercase tracking-wider text-foreground-muted">
                  <th className="text-left font-semibold px-3 py-2">Category</th>
                  <th className="text-right font-semibold px-3 py-2">{priorLabel}</th>
                  <th className="text-right font-semibold px-3 py-2">{currentLabel}</th>
                  <th className="text-right font-semibold px-3 py-2">Change</th>
                  {hasBudget && <th className="text-right font-semibold px-3 py-2">Budget</th>}
                  {hasBudget && <th className="text-right font-semibold px-3 py-2">vs Budget</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.current - r.prior
                  const p = r.prior > 0 ? (d / r.prior) * 100 : null
                  const rUp = d > 0
                  return (
                    <tr key={r.category} className="border-t border-card-border/50">
                      <td className="px-3 py-2 text-foreground truncate max-w-[140px]">{r.category}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{formatCurrency(r.prior)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">{formatCurrency(r.current)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", d === 0 ? "text-foreground-muted" : rUp ? "text-error" : "text-success")}>
                        {d === 0 ? "—" : `${rUp ? "+" : "−"}${formatCurrency(Math.abs(d))}`}
                        {p !== null && d !== 0 ? <span className="text-foreground-muted"> ({rUp ? "+" : ""}{p.toFixed(0)}%)</span> : null}
                      </td>
                      {hasBudget && (
                        <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{r.budget != null ? formatCurrency(r.budget) : "—"}</td>
                      )}
                      {hasBudget && <VsBudgetCell current={r.current} budget={r.budget} />}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function VsBudgetCell({ current, budget }: { current: number; budget: number | null }) {
  if (budget == null || budget <= 0) return <td className="px-3 py-2 text-right text-foreground-muted">—</td>
  const diff = current - budget
  const over = diff > 0
  return (
    <td className={cn("px-3 py-2 text-right tabular-nums font-medium", over ? "text-error" : "text-success")}>
      {over ? "+" : "−"}{formatCurrency(Math.abs(diff))}
      <span className="text-foreground-muted"> ({((current / budget) * 100).toFixed(0)}%)</span>
    </td>
  )
}

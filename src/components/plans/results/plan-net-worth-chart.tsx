"use client"

import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import { primaryAge } from "../plans-helpers"
import type { DollarBasis, PlanDocument, PlanProjection, TaxTreatment, YearRow } from "@/lib/plans/plan-types"

type LayerKey = TaxTreatment | "assets"

const LAYERS: LayerKey[] = ["cash", "taxable", "traditional", "roth", "hsa", "assets"]

type Point = { age: number; year: number; debts: number; netWorth: number } & Record<LayerKey, number>

function emptyLayers(): Record<LayerKey, number> {
  return { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, assets: 0 }
}

function pointFor(
  doc: PlanDocument,
  age: number,
  year: number,
  balances: Record<string, number>,
  assets: number,
  debts: number,
): Point {
  const layers = emptyLayers()
  for (const account of doc.accounts) layers[account.taxTreatment] += balances[account.id] ?? 0
  layers.assets = assets
  const total = LAYERS.reduce((s, k) => s + layers[k], 0)
  return { ...layers, age, year, debts: -debts, netWorth: total - debts }
}

/** Starting point plus a year-end point per row (end of year = next birthday). */
function chartPoints(doc: PlanDocument, projection: PlanProjection, rows: YearRow[]): Point[] {
  const age0 = primaryAge(doc)
  const startBalances = Object.fromEntries(doc.accounts.map((a) => [a.id, a.balance]))
  const startAssets = projection.startNetWorth - projection.startFinancialNetWorth
  const startDebts = doc.accounts.reduce((s, a) => s + a.balance, 0) - projection.startFinancialNetWorth
  const start = pointFor(doc, age0, doc.settings.startYear, startBalances, startAssets, startDebts)
  return [
    start,
    ...rows.map((r) => pointFor(doc, age0 + r.index + 1, r.year + 1, r.balances, r.assetsTotal, r.debtsTotal)),
  ]
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="text-foreground-muted">
        Age {p.age} · {p.year}
      </p>
      <p className="font-semibold text-foreground tabular-nums">{fmtMoney(p.netWorth)} net worth</p>
      {LAYERS.filter((k) => p[k] > 0.5).map((k) => (
        <p key={k} className="text-foreground-muted tabular-nums">
          {k === "assets" ? "Home & other assets" : TAX_TREATMENT_LABELS[k]}: {fmtMoney(p[k])}
        </p>
      ))}
      {p.debts < -0.5 && <p className="text-foreground-muted tabular-nums">Debts: {fmtMoney(p.debts)}</p>}
    </div>
  )
}

interface Props {
  doc: PlanDocument
  projection: PlanProjection
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
}

/** Net worth over the plan, stacked by account tax bucket, with debts below zero. */
export function PlanNetWorthChart({ doc, projection, rows, basis, isHidden }: Props) {
  const { primary, palette, error, foregroundMuted, border, warning } = useChartTheme()
  const points = useMemo(() => chartPoints(doc, projection, rows), [doc, projection, rows])
  const milestones = useMemo(
    () => rows.flatMap((r) => r.milestones.map((name) => ({ name, age: primaryAge(doc) + r.index }))),
    [rows, doc],
  )
  const depleted = rows.find((r) => r.shortfall > 0.5)
  const colors: Record<LayerKey, string> = {
    cash: palette[2] ?? primary,
    taxable: primary,
    traditional: palette[1] ?? warning,
    roth: palette[3] ?? primary,
    hsa: palette[6] ?? primary,
    assets: foregroundMuted,
  }

  return (
    <FireSectionCard
      eyebrow="Net worth"
      title={basis === "today" ? "In today's dollars" : "In future dollars"}
      info="Year-end balances by tax bucket. Home and other assets are stacked on top; debts show below zero."
    >
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={points} margin={{ top: 12, right: 12, left: 4, bottom: 0 }} stackOffset="sign">
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="age" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ChartTooltip />} />
            {LAYERS.map((k) => (
              <Area key={k} type="monotone" dataKey={k} stackId="nw" stroke="none" fill={colors[k]} fillOpacity={k === "assets" ? 0.25 : 0.55} isAnimationActive={false} />
            ))}
            <Area type="monotone" dataKey="debts" stackId="nw" stroke="none" fill={error} fillOpacity={0.35} isAnimationActive={false} />
            <Line type="monotone" dataKey="netWorth" stroke={primary} strokeWidth={2} dot={false} isAnimationActive={false} />
            {milestones.map((m) => (
              <ReferenceLine key={`${m.name}-${m.age}`} x={m.age} stroke={foregroundMuted} strokeDasharray="4 4" label={{ value: m.name, position: "insideTopRight", fontSize: 10, fill: foregroundMuted }} />
            ))}
            {depleted && (
              <ReferenceLine x={primaryAge(doc) + depleted.index} stroke={error} label={{ value: "Money runs out", position: "insideTopLeft", fontSize: 10, fill: error }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {LAYERS.filter((k) => points.some((p) => p[k] > 0.5)).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[k] }} />
            {k === "assets" ? "Home & other assets" : TAX_TREATMENT_LABELS[k]}
          </span>
        ))}
      </div>
    </FireSectionCard>
  )
}

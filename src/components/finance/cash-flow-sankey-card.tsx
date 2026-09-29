"use client"

import { useMemo } from "react"
import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip, type SankeyNodeProps } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { useFinanceTrends } from "@/hooks/finance/use-insights"
import { useFinanceIncome } from "@/hooks/finance/use-settings"
import { buildCashFlowSankey, type CashFlowSankey } from "@/lib/finance/cash-flow-sankey"
import { formatCurrency } from "@/lib/utils"

/** 12 complete months plus the current partial month (dropped by the builder). */
const TREND_MONTHS = 13
const CHART_HEIGHT = 400

type Kind = CashFlowSankey["nodes"][number]["kind"]

interface NodeExtras {
  colors: Record<Kind, string>
  isHidden: boolean
}

function SankeyNode({ x, y, width, height, payload: raw, colors, isHidden }: SankeyNodeProps & NodeExtras) {
  const payload = raw as unknown as { name: string; value: number; kind: Kind }
  // Sources sit on the left edge (label to their left); everything else labels to the right.
  const leftEdge = payload.kind === "source"
  const labelX = leftEdge ? x - 8 : x + width + 8
  const anchor = leftEdge ? "end" : "start"
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={colors[payload.kind]} fillOpacity={0.9} radius={2} />
      <text x={labelX} y={y + height / 2 - 2} textAnchor={anchor} fontSize={11} fill="var(--foreground)">{payload.name}</text>
      <text x={labelX} y={y + height / 2 + 11} textAnchor={anchor} fontSize={10} fill="var(--foreground-muted)" style={{ filter: isHidden ? "blur(5px)" : undefined }}>
        {formatCurrency(payload.value, "USD", 0)}/mo
      </text>
    </Layer>
  )
}

/** Income → spending categories + saved, averaged over the last 12 complete months. */
export function CashFlowSankeyCard({ isHidden }: { isHidden: boolean }) {
  const trends = useFinanceTrends(TREND_MONTHS)
  const income = useFinanceIncome()
  const { primary, success, warning, foregroundMuted, border } = useChartTheme()

  const sankey = useMemo(
    () => buildCashFlowSankey(trends.data?.months ?? [], new Date().toISOString().slice(0, 7), income.data?.override ?? null),
    [trends.data, income.data],
  )

  if (trends.isLoading) return <div className="h-[420px] animate-shimmer rounded-xl" />
  if (!sankey || sankey.links.length === 0) return null

  const colors: Record<Kind, string> = { source: success, hub: primary, spend: foregroundMuted, saved: warning }
  const savedRate = sankey.monthlyIncome > 0 ? (sankey.monthlyIncome - sankey.monthlySpend) / sankey.monthlyIncome : null

  return (
    <div className="bg-card rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>account_tree</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Where your money goes</span>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            Monthly average over the last {sankey.months} complete months
            {income.data?.override ? " · income from your override" : ""}
          </p>
        </div>
        {savedRate !== null && (
          <p className="text-sm text-foreground">
            {savedRate >= 0 ? "Saving" : "Overspending"} <b className="tabular-nums">{Math.abs(Math.round(savedRate * 100))}%</b> of income
          </p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <Sankey
          data={sankey}
          nodePadding={24}
          nodeWidth={10}
          margin={{ top: 8, right: 130, bottom: 24, left: 110 }}
          link={{ stroke: border, strokeOpacity: 0.6 }}
          node={(props: SankeyNodeProps) => <SankeyNode {...props} colors={colors} isHidden={isHidden} />}
        >
          <Tooltip formatter={(v?: number) => (isHidden ? "•••" : `${formatCurrency(v ?? 0, "USD", 0)}/mo`)} contentStyle={{ fontSize: 11 }} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}

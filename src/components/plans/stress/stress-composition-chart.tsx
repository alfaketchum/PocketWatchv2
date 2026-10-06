"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { endingComposition, type CompositionGroup } from "@/lib/plans/stress/stress-histogram"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const HEIGHT = 260
/** Below this share the accounts segment is too short to hold its label. */
const MIN_LABEL_SHARE = 0.12

/** "Under $500k", "$500k–1M", "$4M+". */
function rangeLabel({ from, to }: CompositionGroup): string {
  if (from === -Infinity) return `Under ${fmtCompact(to)}`
  if (to === Infinity) return `${fmtCompact(from)}+`
  return `${fmtCompact(from)}–${fmtCompact(to).replace("$", "")}`
}

type Row = CompositionGroup & { label: string; share: string }

function GroupTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: Row }>; unit: string }) {
  const g = payload?.[0]?.payload
  if (!active || !g) return null
  const line = (label: string, value: string, strong = false) => (
    <p className={`flex justify-between gap-4 ${strong ? "text-foreground" : "text-foreground-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  )
  const share = g.accountsShare
  return (
    <div className="w-56 space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Net worth {g.label}</p>
      {line("Accounts", share === null ? "—" : fmtPct(share, 0), true)}
      {line("Home & property", share === null ? "—" : fmtPct(1 - share, 0))}
      <div className="border-t border-card-border pt-0.5">{line(unit[0].toUpperCase() + unit.slice(1), g.count.toLocaleString())}</div>
      {line("Average accounts", fmtMoney(g.accounts / g.count))}
      {g.ranOut > 0 && <p className="pt-0.5 text-error">{g.ranOut} ran out of money</p>}
    </div>
  )
}

/** Ending net worth ranges, each bar split by share: money in accounts vs home and other property (net of debts). */
export function StressCompositionChart({ cohorts, unit, isHidden }: { cohorts: CohortResult[]; unit: string; isHidden: boolean }) {
  const { primary, foregroundMuted, foreground, border } = useChartTheme()
  const narrow = useIsNarrow()
  const data = useMemo<Row[]>(
    () => endingComposition(cohorts).map((g) => ({ ...g, label: rangeLabel(g), share: g.accountsShare === null || g.accountsShare < MIN_LABEL_SHARE ? "" : fmtPct(g.accountsShare, 0) })),
    [cohorts],
  )
  return (
    <div>
      <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="18%">
            <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} interval={narrow ? 1 : 0} />
            <YAxis tickFormatter={(v: number) => fmtPct(v, 0)} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={narrow ? NARROW_AXIS_WIDTH : 40} />
            <Tooltip content={<GroupTooltip unit={unit} />} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
            <Bar dataKey="accounts" stackId="worth" fill={primary} fillOpacity={0.9} isAnimationActive={false}>
              {!narrow && <LabelList dataKey="share" position="insideTop" style={{ fontSize: 10, fill: "var(--card)" }} />}
            </Bar>
            <Bar dataKey="property" stackId="worth" fill={foregroundMuted} fillOpacity={0.35} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: primary }} /> Accounts
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: foregroundMuted, opacity: 0.35 }} /> Home &amp; property
        </span>
        <span>By ending net worth</span>
      </div>
    </div>
  )
}

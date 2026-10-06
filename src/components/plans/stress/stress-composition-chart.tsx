"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { endingComposition, type CompositionGroup } from "@/lib/plans/stress/stress-histogram"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const HEIGHT = 260

const shareLabel = (g: CompositionGroup) => (g.accountsShare === null ? "—" : `${fmtPct(g.accountsShare, 0)} in accounts`)
/** When the top group dwarfs the rest, the axis stops this far above the next-tallest bar and the top one is clipped. */
const CLIP_RATIO = 2
const HEADROOM = 1.25

/** The y-axis top: clipped when one bar is more than CLIP_RATIO times the next, so the rest stay readable. */
function axisTop(groups: CompositionGroup[]): number | null {
  const worths = groups.map((g) => g.accounts + g.property).sort((a, b) => b - a)
  const [first, second] = worths
  return second > 0 && first > second * CLIP_RATIO ? second * HEADROOM : null
}

function GroupTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: CompositionGroup }>; unit: string }) {
  const g = payload?.[0]?.payload
  if (!active || !g) return null
  const line = (label: string, value: string, strong = false) => (
    <p className={`flex justify-between gap-4 ${strong ? "text-foreground" : "text-foreground-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  )
  return (
    <div className="w-64 space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">
        {g.label} of {unit} by ending net worth
      </p>
      {line("Money in accounts", fmtMoney(g.accounts), true)}
      {line("Home & other property, net", fmtMoney(g.property))}
      <div className="border-t border-card-border pt-0.5">{line("Net worth", fmtMoney(g.netWorth), true)}</div>
      {line("Accounts share", g.accountsShare === null ? "—" : fmtPct(g.accountsShare, 0))}
      {g.ranOut > 0 && <p className="pt-0.5 text-error">{g.ranOut} of these {g.count} ran out of money</p>}
    </div>
  )
}

/**
 * Ending net worth split into money in accounts and home and other property, for each tenth of the trials (averages),
 * with the accounts' share on top: a run can end with a valuable home and nothing left to spend.
 */
export function StressCompositionChart({ cohorts, unit, isHidden }: { cohorts: CohortResult[]; unit: string; isHidden: boolean }) {
  const { primary, foregroundMuted, foreground, border } = useChartTheme()
  const narrow = useIsNarrow()
  const { data, top } = useMemo(() => {
    const groups = endingComposition(cohorts)
    const cap = axisTop(groups)
    const clipped = (g: CompositionGroup) => cap !== null && g.accounts + g.property > cap
    return { top: cap, data: groups.map((g) => ({ ...g, share: clipped(g) ? `${shareLabel(g)} · ↑ ${fmtCompact(g.netWorth)}` : shareLabel(g) })) }
  }, [cohorts])
  return (
    <div>
      <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 34, right: 8, bottom: 0, left: 4 }} barCategoryGap="18%">
            <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} interval={narrow ? 1 : 0} />
            <YAxis domain={top !== null ? [0, top] : [0, "auto"]} allowDataOverflow={top !== null} tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={narrow ? NARROW_AXIS_WIDTH : 56} />
            <Tooltip content={<GroupTooltip unit={unit} />} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
            <Bar dataKey="accounts" stackId="worth" fill={primary} fillOpacity={0.9} isAnimationActive={false} />
            <Bar dataKey="property" stackId="worth" fill={foregroundMuted} fillOpacity={0.35} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {!narrow && <LabelList dataKey="share" position="top" style={{ fontSize: 10, fill: foregroundMuted }} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: primary }} /> Money in accounts
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: foregroundMuted, opacity: 0.35 }} /> Home &amp; other property, net of debts
        </span>
        <span>
          Averages for each tenth of the {unit}, lowest ending net worth on the left; the label is the accounts&apos; share.
          {top !== null && " The tallest bar runs off the chart (its net worth is in its label) so the rest stay readable."}
        </span>
      </div>
    </div>
  )
}

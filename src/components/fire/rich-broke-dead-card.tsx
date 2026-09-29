"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { richBrokeDead, type LifeTable, type LifeTableSex, type RbdRow } from "@/lib/fire/rich-broke-dead"
import lifeTableJson from "@/lib/fire/data/us-life-table.json"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtPct } from "./fire-helpers"
import { ChoiceChips } from "./fire-input-controls"
import { FireSectionCard } from "./fire-section-card"

const LIFE_TABLE = lifeTableJson as LifeTable
const SPOTLIGHT_AGE = 90

const SEX_OPTIONS: { value: LifeTableSex; label: string }[] = [
  { value: "total", label: "Everyone" },
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
]

function spotlight(rows: RbdRow[]): string | null {
  const row = rows.find((r) => r.age === SPOTLIGHT_AGE) ?? rows[rows.length - 1]
  if (!row) return null
  const fine = row.above + row.below
  return `At ${row.age}: ${fmtPct(fine, 0)} chance you're alive with money left, ${fmtPct(row.broke, 1)} alive and broke, ${fmtPct(row.dead, 0)} not alive.`
}

/** Engaging Data's "Rich, Broke or Dead": mortality × historical portfolio survival, by age. */
export function RichBrokeDeadCard({ state }: { state: FirePlanState }) {
  const { history, simOptions, plan, analysis } = state
  const [sex, setSex] = useState<LifeTableSex>("total")
  const { success, warning, error, foregroundMuted, border } = useChartTheme()

  const rows = useMemo(
    () => (history ? richBrokeDead(history, simOptions, plan.swr, analysis.retireAge, LIFE_TABLE[sex]) : []),
    [history, simOptions, plan.swr, analysis.retireAge, sex],
  )
  if (!history || rows.length === 0) return null

  return (
    <FireSectionCard
      eyebrow="Rich, broke or dead"
      title={spotlight(rows)}
      info={`Your plan (${fmtPct(plan.swr, 2)} withdrawals, your allocation and retirement income) through every historical start since 1871, combined with ${LIFE_TABLE.source}. Treats markets and lifespan as independent. Idea from Engaging Data.`}
      right={<ChoiceChips label="Life table" options={SEX_OPTIONS} value={sex} onChange={setSex} />}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} stackOffset="expand">
          <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => fmtPct(v, 0)} axisLine={false} tickLine={false} width={40} />
          <Tooltip formatter={(v?: number) => fmtPct(v ?? 0, 1)} labelFormatter={(a) => `Age ${a}`} contentStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="above" name="Alive · more than you started with" stackId="1" stroke="none" fill={success} fillOpacity={0.75} isAnimationActive={false} />
          <Area type="monotone" dataKey="below" name="Alive · less than you started with" stackId="1" stroke="none" fill={warning} fillOpacity={0.7} isAnimationActive={false} />
          <Area type="monotone" dataKey="broke" name="Alive · broke" stackId="1" stroke="none" fill={error} fillOpacity={0.85} isAnimationActive={false} />
          <Area type="monotone" dataKey="dead" name="Not alive" stackId="1" stroke="none" fill={foregroundMuted} fillOpacity={0.35} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" /> More than you started with</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-warning inline-block" /> Less, but not broke</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-error inline-block" /> Broke</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-foreground-muted/40 inline-block" /> Not alive</span>
      </div>
    </FireSectionCard>
  )
}

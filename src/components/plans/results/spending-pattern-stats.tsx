"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import type { ChartRow } from "./use-chart-series"

const LATE_AGE = 80
/** Differences under this share read as "same as all steady". */
const SAME = 0.005

function Stat({ label, value, steady }: { label: string; value: number; steady: number }) {
  const diff = steady > 0 ? value / steady - 1 : 0
  const same = Math.abs(diff) < SAME
  const tone = same ? "text-foreground-muted" : diff < 0 ? "text-success" : "text-error"
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(value)}</p>
      <p className={`text-[11px] tabular-nums ${tone}`}>
        {same ? "same as all steady" : `${diff > 0 ? "+" : "−"}${Math.abs(diff * 100).toFixed(0)}% vs all steady`}
      </p>
    </div>
  )
}

/** Lifetime, at-retirement and at-80 spending with your patterns, against every line steady (the dashed line). */
export function SpendingPatternStats({ points, retireAge }: { points: ChartRow[]; retireAge: number | null }) {
  const at = (age: number | null) => (age === null ? undefined : points.find((p) => p.age === age))
  const retire = at(retireAge)
  const late = at(LATE_AGE)
  const total = (key: "spent" | "steady") => points.reduce((s, p) => s + (p[key] ?? 0), 0)
  return (
    <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-card-border px-3 py-2">
      <Stat label="Lifetime" value={total("spent")} steady={total("steady")} />
      {retire ? <Stat label={`At retirement (${retire.age})`} value={retire.spent ?? 0} steady={retire.steady ?? 0} /> : <div />}
      {late ? <Stat label={`At ${LATE_AGE}`} value={late.spent ?? 0} steady={late.steady ?? 0} /> : <div />}
    </div>
  )
}

"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { PlanSummary } from "@/lib/plans/plan-types"
import { PIN_FIRST_COLUMN_ON_PHONES } from "../editor/plan-table"
import { cn } from "@/lib/utils"

export interface Metric {
  label: string
  value: (s: PlanSummary) => string
  /** The number the difference is taken on; null when there's none (never retires, money lasts). */
  num: (s: PlanSummary) => number | null
  fmtDelta: (d: number) => string
  /** Which way is better; null = neither (retiring earlier or later is a choice). */
  better: "higher" | "lower" | null
  money?: boolean
}

const signed = (d: number, text: string) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${text}`
const moneyDelta = (d: number) => signed(d, fmtCompact(Math.abs(d)))
const yearsDelta = (d: number) => signed(d, `${Math.abs(d)} yr${Math.abs(d) === 1 ? "" : "s"}`)

export const METRICS: Metric[] = [
  {
    label: "Retire",
    value: (s) => (s.retirementAge === null ? "—" : `Age ${s.retirementAge} (${s.retirementYear})`),
    num: (s) => s.retirementAge,
    fmtDelta: yearsDelta,
    better: null,
  },
  {
    label: "Net worth at retirement",
    value: (s) => (s.netWorthAtRetirement === null ? "—" : fmtCompact(s.netWorthAtRetirement)),
    num: (s) => s.netWorthAtRetirement,
    fmtDelta: moneyDelta,
    better: "higher",
    money: true,
  },
  {
    label: "Money lasts",
    value: (s) => (s.depletedAge === null ? `Past ${s.endAge}` : `Until ${s.depletedAge}`),
    num: (s) => s.depletedAge ?? s.endAge,
    fmtDelta: yearsDelta,
    better: "higher",
  },
  { label: "Ending net worth", value: (s) => fmtCompact(s.endingNetWorth), num: (s) => s.endingNetWorth, fmtDelta: moneyDelta, better: "higher", money: true },
  { label: "Lifetime taxes", value: (s) => fmtCompact(s.lifetimeTaxes), num: (s) => s.lifetimeTaxes, fmtDelta: moneyDelta, better: "lower", money: true },
]

export function Delta({ metric, a, b, isHidden }: { metric: Metric; a: PlanSummary; b: PlanSummary; isHidden: boolean }) {
  const x = metric.num(a)
  const y = metric.num(b)
  if (x === null || y === null) return <span className="text-foreground-muted">—</span>
  const d = y - x
  if (Math.abs(d) < 0.5) return <span className="text-foreground-muted">Same</span>
  const good = metric.better === null ? null : (d > 0) === (metric.better === "higher")
  const color = good === null ? "text-foreground" : good ? "text-success" : "text-error"
  return (
    <span className={`font-medium ${color}`} style={metric.money && isHidden ? { filter: "blur(6px)" } : undefined}>
      {metric.fmtDelta(d)}
    </span>
  )
}

interface Props {
  a: PlanSummary
  b: PlanSummary
  names: [string, string]
  colors: [string, string]
  isHidden: boolean
}

/** Key numbers for A and B, in today's dollars, with B's difference from A. */
export function CompareTable({ a, b, names, colors, isHidden }: Props) {
  const head = "px-3 py-2 text-right text-xs font-semibold text-foreground whitespace-nowrap"
  return (
    <FireSectionCard eyebrow="Key numbers" title="Today's dollars">
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className={cn("w-full text-sm", PIN_FIRST_COLUMN_ON_PHONES)}>
          <thead>
            <tr>
              <th className="px-5 sm:px-6 py-2" />
              {names.map((name, i) => (
                <th key={i} className={head}>
                  <span className="inline-block h-2 w-2 rounded-sm mr-1.5" style={{ background: colors[i] }} />
                  {name}
                </th>
              ))}
              <th className={`${head} pr-5 sm:pr-6`}>B vs A</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.label} className="border-t border-card-border">
                <td className="px-5 sm:px-6 py-2 text-xs text-foreground-muted whitespace-nowrap">{m.label}</td>
                {[a, b].map((s, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={m.money && isHidden ? { filter: "blur(6px)" } : undefined}>
                    {m.value(s)}
                  </td>
                ))}
                <td className="px-3 pr-5 sm:pr-6 py-2 text-right tabular-nums whitespace-nowrap">
                  <Delta metric={m} a={a} b={b} isHidden={isHidden} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FireSectionCard>
  )
}

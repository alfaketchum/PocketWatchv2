"use client"

import { Fragment, useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"
import type { LoanSchedule, ScheduleYear } from "@/lib/plans/plan-amortization"

export interface LoanColors {
  principal: string
  interest: string
}

/** Principal and interest as one bar, its length the year's payment against the largest year's. */
function SplitBar({ year, max, colors }: { year: ScheduleYear; max: number; colors: LoanColors }) {
  const share = max > 0 ? year.payment / max : 0
  const interestShare = year.payment > 0 ? year.interest / year.payment : 0
  const label = `Principal ${fmtMoney(year.principal)} · Interest ${fmtMoney(year.interest)} (${Math.round(interestShare * 100)}% interest)`
  return (
    <div className="flex h-2.5 w-full items-center" title={label} aria-label={label} role="img">
      <div className="flex h-full gap-[2px]" style={{ width: `${share * 100}%` }}>
        {year.principal > 0 && <span className="h-full rounded-l-[4px] last:rounded-r-[4px]" style={{ flex: year.principal, background: colors.principal }} />}
        {year.interest > 0 && <span className="h-full rounded-r-[4px] first:rounded-l-[4px]" style={{ flex: year.interest, background: colors.interest }} />}
      </div>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

const HEAD = "px-1.5 sm:px-2 py-1.5 text-right font-medium whitespace-nowrap"
const NUM = "px-1.5 sm:px-2 py-1.5 text-right tabular-nums"

/** Year-by-year payments, principal and interest; click a year for its twelve months. */
export function LoanScheduleTable({ schedule, age0, colors }: { schedule: LoanSchedule; age0: number; colors: LoanColors }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (index: number) => setOpen((s) => (s.has(index) ? new Set([...s].filter((i) => i !== index)) : new Set([...s, index])))
  const max = Math.max(0, ...schedule.years.map((y) => y.payment))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
        <Swatch color={colors.principal} label="Principal (pays the loan down)" />
        <Swatch color={colors.interest} label="Interest (the cost of borrowing)" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full sm:min-w-[560px] text-xs">
          <thead className="bg-foreground/[0.03] text-foreground-muted">
            <tr>
              <th className="px-1.5 sm:px-2 py-1.5 text-left font-medium">Year</th>
              <th className="hidden sm:table-cell px-2 py-1.5 text-left font-medium w-[22%]">Split</th>
              <th className={cn(HEAD, "hidden sm:table-cell")}>Paid</th>
              <th className={HEAD}>Interest</th>
              <th className={HEAD}>Principal</th>
              <th className={HEAD}>Owed</th>
            </tr>
          </thead>
          <tbody>
            {schedule.years.map((y) => {
              const crossover = schedule.crossover?.year === y.year
              const expanded = open.has(y.index)
              return (
                <Fragment key={y.index}>
                  <tr
                    onClick={() => toggle(y.index)}
                    className={cn("cursor-pointer border-t border-card-border hover:bg-foreground/[0.03]", y.afterPlan && "text-foreground-muted")}
                  >
                    <td className="px-1.5 sm:px-2 py-1.5 whitespace-nowrap">
                      <span className="material-symbols-rounded align-middle text-foreground-muted" style={{ fontSize: 14 }} aria-hidden="true">
                        {expanded ? "expand_more" : "chevron_right"}
                      </span>
                      {y.year} <span className="hidden sm:inline text-foreground-muted">· {age0 + y.index}</span>
                      {crossover && <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">Crossover</span>}
                    </td>
                    <td className="hidden sm:table-cell px-2 py-1.5">
                      <SplitBar year={y} max={max} colors={colors} />
                    </td>
                    <td className={cn(NUM, "hidden sm:table-cell")}>{fmtMoney(y.payment)}</td>
                    <td className={NUM}>{fmtMoney(y.interest)}</td>
                    <td className={NUM}>{fmtMoney(y.principal)}</td>
                    <td className={NUM}>{fmtMoney(y.balance)}</td>
                  </tr>
                  {expanded &&
                    y.months.map((m) => (
                      <tr key={m.n} className="bg-foreground/[0.02] text-foreground-muted">
                        <td className="py-1 pl-7 pr-2">Payment {m.n}</td>
                        <td className="hidden sm:table-cell" />
                        <td className={cn(NUM, "hidden sm:table-cell")}>{fmtMoney(m.payment)}</td>
                        <td className={NUM}>{fmtMoney(m.interest)}</td>
                        <td className={NUM}>{fmtMoney(m.principal)}</td>
                        <td className={NUM}>{fmtMoney(m.balance)}</td>
                      </tr>
                    ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

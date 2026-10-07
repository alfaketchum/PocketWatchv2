"use client"

import { Fragment, useState, type CSSProperties } from "react"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { planChangedFlags, type PlanCheckInRow } from "@/lib/plans/check-in/check-in-rows"
import { CheckInCategories } from "./check-in-categories"

const INFO =
  "Recorded on the 1st of each month (actuals refreshed on the 8th for late transactions). The plan columns are what your primary plan said for that month when it was recorded, so editing the plan later doesn't change them. Take-home is pay after payroll contributions and taxes, which is what reaches your accounts. Spending leaves out transfers, investments and taxes; the plan's loan payments count as spending. Rows marked est. were filled in later from the plan as it was then."

const COLUMNS = ["Net worth", "Take-home", "Spending"] as const

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

/** Actual, plan and the difference; `higherIsBetter` picks which way is green. */
function Triple({ actual, planned, higherIsBetter, compact, blur }: {
  actual: number | null
  planned: number | null
  higherIsBetter: boolean
  compact: boolean
  blur?: CSSProperties
}) {
  const fmt = (v: number | null) => (v === null ? "—" : compact ? fmtCompact(v) : fmtMoney(v))
  const diff = actual !== null && planned !== null ? actual - planned : null
  const good = diff !== null && (higherIsBetter ? diff >= 0 : diff <= 0)
  const tone = diff === null || Math.abs(diff) < 1 ? "text-foreground-muted" : good ? "text-success" : "text-error"
  return (
    <>
      <td className="whitespace-nowrap py-1.5 pl-3 text-right font-data text-foreground" style={blur}>{fmt(actual)}</td>
      <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground-muted" style={blur}>{fmt(planned)}</td>
      <td className={`whitespace-nowrap py-1.5 pl-2 text-right font-data ${tone}`} style={blur}>
        {diff !== null && diff > 0 ? "+" : ""}
        {fmt(diff)}
      </td>
    </>
  )
}

function MonthCell({ row, changed, open, onToggle }: { row: PlanCheckInRow; changed: boolean; open: boolean; onToggle: () => void }) {
  return (
    <td className="sticky left-0 z-[1] bg-card whitespace-nowrap py-1.5 pr-2">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-1 text-foreground hover:text-primary">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>
          {open ? "expand_more" : "chevron_right"}
        </span>
        <span className="font-data">{monthName(row.month)}</span>
      </button>
      <span className="ml-5 flex gap-1">
        {row.plannedSource === "backfill" && (
          <span className="rounded-full border border-card-border px-1.5 text-[10px] text-foreground-muted" title="Planned figures filled in later from the plan as it was then">
            est.
          </span>
        )}
        {changed && (
          <span className="rounded-full border border-card-border px-1.5 text-[10px] text-primary" title={`The plan (${row.planName}) changed since the month before`}>
            plan changed
          </span>
        )}
      </span>
    </td>
  )
}

/** Each recorded month: net worth, take-home pay and spending against what the plan said at the time. */
export function CheckInTable({ rows, isHidden }: { rows: PlanCheckInRow[]; isHidden: boolean }) {
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const changed = planChangedFlags(rows)
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  return (
    <FireSectionCard eyebrow="Monthly check-ins" title="Each month against the plan at the time" info={INFO}>
      <div className="scroll-hint overflow-x-auto">
        <table className="w-full min-w-[46rem] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th rowSpan={2} className="sticky left-0 z-[1] bg-card py-1.5 pr-2 text-left align-bottom font-semibold">Month</th>
              {COLUMNS.map((c) => (
                <th key={c} colSpan={3} className="pl-3 pt-1.5 text-right font-semibold text-foreground">{c}</th>
              ))}
            </tr>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              {COLUMNS.map((c) => (
                <Fragment key={c}>
                  <th className="py-1 pl-3 text-right font-semibold">Actual</th>
                  <th className="py-1 pl-2 text-right font-semibold">Plan</th>
                  <th className="py-1 pl-2 text-right font-semibold">Δ</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <Fragment key={row.month}>
                <tr className="border-t border-card-border align-top">
                  <MonthCell row={row} changed={changed[i]} open={openMonth === row.month} onToggle={() => setOpenMonth(openMonth === row.month ? null : row.month)} />
                  <Triple actual={row.actualNetWorth} planned={row.plannedNetWorth} higherIsBetter compact blur={blur} />
                  <Triple actual={row.actualIncome} planned={row.plannedIncome} higherIsBetter compact={false} blur={blur} />
                  <Triple actual={row.actualSpending} planned={row.plannedSpending} higherIsBetter={false} compact={false} blur={blur} />
                </tr>
                {openMonth === row.month && (
                  <tr>
                    <td colSpan={10}>
                      <CheckInCategories row={row} isHidden={isHidden} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </FireSectionCard>
  )
}

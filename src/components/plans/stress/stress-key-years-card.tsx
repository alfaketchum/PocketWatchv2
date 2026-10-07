"use client"

import { useMemo } from "react"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { PlanDocument, PlanProjection } from "@/lib/plans/plan-types"
import { keyYears } from "@/lib/plans/stress/stress-key-years"

const INFO =
  "Only the years where something happens in your plan: a job starts or ends, a purchase (with its down payment), a child, a move, retirement, money arriving, and the year the accounts are depleted (amber) or assets are exhausted (net worth below one year of spending) (red), on your plan's steady returns. Pay is household pay (salaries, business and stock pay); Out is spending plus loan payments; Accounts and Net worth are at the year's end. All in today's dollars. The median stress trial's depletion age is marked too."

interface Props {
  doc: PlanDocument
  projection: PlanProjection
  /** The stress test's typical run-out age, marked as its own row (null when nothing runs out). */
  runOutAge: number | null
  isHidden: boolean
}

/** "Key years": the plan's big moments, each with pay, what goes out, accounts and net worth that year. */
export function StressKeyYearsCard({ doc, projection, runOutAge, isHidden }: Props) {
  const rows = useMemo(() => keyYears(doc, projection, runOutAge), [doc, projection, runOutAge])
  if (rows.length === 0) return null
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const money = (v: number) => (Math.abs(v) < 500 ? "$0" : fmtCompact(v))
  return (
    <FireSectionCard eyebrow="Key years" title="Your plan's big moments, today's dollars" info={INFO}>
      <div className="scroll-hint overflow-x-auto">
        <table className="w-full min-w-[40rem] text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="sticky left-0 bg-card py-1.5 pr-2 font-semibold">Age</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Pay</th>
              <th className="py-1.5 pl-2 text-right font-semibold" title="Spending plus loan payments">Out</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Accounts</th>
              <th className="py-1.5 pl-2 text-right font-semibold">Net worth</th>
              <th className="py-1.5 pl-4 font-semibold">What happens</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} className="border-t border-card-border align-top">
                <td className="sticky left-0 bg-card whitespace-nowrap py-1.5 pr-2 text-foreground">
                  <span className="font-data">{r.age}</span> <span className="text-foreground-muted">· {r.year}</span>
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground" style={blur}>
                  {money(r.pay)}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground-muted" style={blur}>
                  {money(r.out)}
                </td>
                <td className={`whitespace-nowrap py-1.5 pl-2 text-right font-data ${r.accounts < 500 ? "text-warning" : "text-foreground"}`} style={blur}>
                  {money(r.accounts)}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground-muted" style={blur}>
                  {money(r.netWorth)}
                </td>
                <td className="py-1.5 pl-4">
                  {r.events.map((e) => (
                    <span key={e.text} className={`block ${e.tone === "bad" ? "font-medium text-error" : e.tone === "warn" ? "font-medium text-warning" : "text-foreground"}`}>
                      {e.text}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FireSectionCard>
  )
}

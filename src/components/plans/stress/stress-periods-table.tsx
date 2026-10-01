"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { NOTABLE_PERIODS } from "@/lib/fire/fire-constants"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

/** How the plan fares starting in history's worst years (when there's enough history after them). */
export function StressPeriodsTable({ cohorts, isHidden }: { cohorts: CohortResult[]; isHidden: boolean }) {
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
          <th className="py-1.5 font-semibold">Starting in</th>
          <th className="py-1.5 font-semibold">Outcome</th>
          <th className="py-1.5 text-right font-semibold">Lowest invested</th>
          <th className="py-1.5 text-right font-semibold">Ending net worth</th>
        </tr>
      </thead>
      <tbody>
        {NOTABLE_PERIODS.map((p) => {
          const c = cohorts.find((x) => x.year === p.year)
          return (
            <tr key={p.year} className="border-t border-card-border">
              <td className="py-1.5 text-foreground">{p.label}</td>
              {c ? (
                <>
                  <td className={`py-1.5 ${c.depletedAge !== null ? "text-error" : "text-success"}`}>
                    {c.depletedAge !== null ? `Runs out at ${c.depletedAge}` : "Lasts"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground" style={blur}>{fmtMoney(Math.min(...c.invested))}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground" style={blur}>{fmtMoney(c.netWorth.at(-1) ?? 0)}</td>
                </>
              ) : (
                <td colSpan={3} className="py-1.5 text-foreground-muted">Not enough history after it yet for a plan this long</td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

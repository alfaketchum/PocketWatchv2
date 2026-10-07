"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { compareCategories, type PlanCheckInRow } from "@/lib/plans/check-in/check-in-rows"

/** One month's spending by category against the plan, biggest overspend first. */
export function CheckInCategories({ row, isHidden }: { row: PlanCheckInRow; isHidden: boolean }) {
  const categories = compareCategories(row)
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  return (
    <div className="py-2 pl-2 sm:pl-4">
      <table className="w-full max-w-xl text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
            <th className="py-1 pr-2 font-semibold">Category</th>
            <th className="py-1 pl-2 text-right font-semibold">Actual</th>
            <th className="py-1 pl-2 text-right font-semibold">Plan</th>
            <th className="py-1 pl-2 text-right font-semibold">Over / under</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.category} className="border-t border-card-border">
              <td className="py-1 pr-2 text-foreground">{c.category}</td>
              <td className="py-1 pl-2 text-right font-data text-foreground" style={blur}>{fmtMoney(c.actual)}</td>
              <td className="py-1 pl-2 text-right font-data text-foreground-muted" style={blur}>{fmtMoney(c.planned)}</td>
              <td className={`py-1 pl-2 text-right font-data ${Math.abs(c.over) < 1 ? "text-foreground-muted" : c.over > 0 ? "text-error" : "text-success"}`} style={blur}>
                {c.over > 0 ? "+" : ""}
                {fmtMoney(c.over)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {row.plannedOneTime > 0 && (
        <p className="mt-2 text-[11px] text-foreground-muted" style={blur}>
          The plan also has {fmtMoney(row.plannedOneTime)} of one-time spending in this plan year, left out of the monthly plan.
        </p>
      )}
    </div>
  )
}

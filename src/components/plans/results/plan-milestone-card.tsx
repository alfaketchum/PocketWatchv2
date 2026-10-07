"use client"

import type { ChartMilestone } from "@/lib/plans/plan-chart"
import { milestoneUses } from "@/lib/plans/plan-milestone-uses"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { HoveredMark } from "./plan-chart-plot"

/** What to say under a milestone's name: what's tied to it, or where it comes from. */
function milestoneSubtext(mark: ChartMilestone, doc: PlanDocument): string {
  if (mark.kind === "depleted") return "Your accounts can't pay this year's bills; anything you own is still there and could be sold."
  if (mark.kind === "broke") return "Net worth is $0 or less: the cash is gone and nothing is left to sell."
  if (mark.kind === "child") return "From Kids · edit on Expenses → Kids"
  if (mark.kind === "asset") return "From Assets & debts · edit it there"
  if (mark.kind === "income") return "From Income · edit it there"
  if (mark.kind === "payoff") return "Last payment on this loan · change it on Assets & debts"
  if (mark.kind === "rmd") return "The IRS minimum must now come out of 401(k)s and IRAs each year (73, or 75 if born 1960+)"
  const uses = milestoneUses(doc, mark.id)
  return uses.length > 0 ? `Used by: ${uses.join(" · ")}` : "Nothing is tied to it yet"
}

/** Half the card's width: the most it can be centered toward an edge of the chart without running off it. */
const HALF_CARD = "7.5rem"

/** Hover card for a milestone icon, placed just below the icon (slid inward near the chart's edges). */
export function MilestoneCard({ hovered, doc }: { hovered: HoveredMark; doc: PlanDocument }) {
  const { mark, x, y } = hovered
  return (
    <div
      className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: `clamp(${HALF_CARD}, ${x}px, calc(100% - ${HALF_CARD}))`, top: y + 16 }}
    >
      <p className="font-semibold text-foreground">{mark.name}</p>
      <p className="text-foreground-muted">
        {mark.year} · age {mark.age}
      </p>
      <p className="mt-1 text-[11px] text-foreground-muted">{milestoneSubtext(mark, doc)}</p>
    </div>
  )
}

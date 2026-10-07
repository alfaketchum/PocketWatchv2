"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo } from "react"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { rowInTodaysDollars } from "@/lib/plans/plan-dollars"
import type { YearRow } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { CashBufferEditor } from "./cash-buffer-editor"
import { ShortfallWaterfall } from "./shortfall-waterfall"
import { SurplusWaterfall } from "./surplus-waterfall"

const total = (record: Record<string, number>) => Object.values(record).reduce((s, v) => s + v, 0)

/** The plan's first year with money left over, and its first year that ran short (today's $). */
function exampleYears(rows: YearRow[]): { surplus: YearRow | null; shortfall: YearRow | null } {
  return {
    surplus: rows.find((r) => total(r.surplusBy) >= 0.5) ?? null,
    shortfall: rows.find((r) => total(r.shortfallBy) >= 0.5) ?? null,
  }
}

/**
 * Cash-flow rules. Each year, income − taxes − spending is either left over (filling the left
 * waterfall) or short (drawn from the right one). The cash buffer is the first stop of one and
 * the last resort of the other.
 */
export function CashFlowEditor(props: PlanEditorProps) {
  const { doc } = props
  const planId = useParams<{ id?: string }>()?.id
  const conversions = (doc.conversions ?? []).length
  const examples = useMemo(
    () => exampleYears(simulatePlan(doc).rows.map((r) => rowInTodaysDollars(r, inflationOf(doc.settings)))),
    [doc],
  )
  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground-muted">
        Each year, <span className="font-medium text-foreground">income − taxes − spending</span> is either{" "}
        a <span className="text-success font-medium">surplus</span> or a <span className="text-error font-medium">deficit</span>.
      </p>
      <CashBufferEditor {...props} />
      {planId && (
        <Link href={`/plans/${planId}/roth`} className="flex items-center justify-between gap-3 rounded-xl border border-card-border px-4 py-3 text-xs hover:border-card-border-hover">
          <span className="text-foreground">
            <span className="font-medium">Roth conversions</span>
            <span className="text-foreground-muted"> · {conversions === 0 ? "none yet" : `${conversions} rule${conversions === 1 ? "" : "s"}`}</span>
          </span>
          <span className="text-primary">Open the Roth page</span>
        </Link>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <SurplusWaterfall {...props} example={examples.surplus} />
        <ShortfallWaterfall {...props} example={examples.shortfall} />
      </div>
    </div>
  )
}

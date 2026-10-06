"use client"

import { useMemo } from "react"
import { deflator } from "@/lib/plans/plan-dollars"
import { inflationOf } from "@/lib/plans/plan-inflation"
import type { PlanDocument, PlanProjection } from "@/lib/plans/plan-types"
import type { OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"

/**
 * The outcome buckets' yardsticks, from this plan, on whichever the chart shows: the money in your accounts today
 * (or net worth after the first year), and a year of spending at the end.
 */
export function usePlanYardsticks(doc: PlanDocument, projection: PlanProjection, measure: OutcomeYardsticks["measure"] = "invested"): OutcomeYardsticks {
  return useMemo(() => {
    const inflation = inflationOf(doc.settings)
    const spending = projection.rows.map((r) => r.expenses / deflator(inflation, r.index, "flow")).filter((v) => v > 0)
    const first = projection.rows[0]
    const netWorth = first ? first.netWorth / deflator(inflation, first.index, "balance") : 0
    return {
      startValue: measure === "netWorth" ? netWorth : doc.accounts.reduce((s, a) => s + a.balance, 0),
      yearlySpending: spending.at(-1) ?? 0,
      endAge: doc.settings.endAge,
      measure,
    }
  }, [projection, doc.settings, doc.accounts, measure])
}

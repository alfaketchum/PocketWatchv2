"use client"

import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo, useState } from "react"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { rowsForBasis } from "@/lib/plans/plan-dollars"
import { expandPlan } from "@/lib/plans/plan-expand"
import { summarizePlan } from "@/lib/plans/plan-summary"
import type { DollarBasis, PlanDocument } from "@/lib/plans/plan-types"

/**
 * Projection of a plan document, with rows in the chosen dollar basis. `view` is the document with
 * generated items (kids' expenses, generated milestones) folded in, for charts and tables to name them.
 */
export function usePlanProjection(document: PlanDocument | null) {
  const [basis, setBasis] = useState<DollarBasis>("today")
  const projection = useMemo(() => (document ? simulatePlan(document) : null), [document])
  const view = useMemo(() => (document ? expandPlan(document) : null), [document])
  const summary = useMemo(
    () => (document && projection ? summarizePlan(document, projection) : null),
    [document, projection],
  )
  const rows = useMemo(
    () => (document && projection ? rowsForBasis(projection.rows, basis, inflationOf(document.settings)) : []),
    [document, projection, basis],
  )
  return { projection, summary, rows, basis, setBasis, view }
}

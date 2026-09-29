"use client"

import { useMemo } from "react"
import { useFireInputs } from "./use-fire-profile"
import { useFireBaseline, useFireHistoryData } from "./use-fire-baseline"
import { analyzePlan, simOptionsForPlan } from "@/lib/fire/fire-analysis"
import { resolvePlan } from "@/lib/fire/fire-plan"

/** Everything the FIRE pages render from: inputs, baseline, resolved plan, analysis, history. */
export function useFirePlan() {
  const { inputs, update, isLoading: inputsLoading, isSaving } = useFireInputs()
  const { baseline, isLoading: baselineLoading } = useFireBaseline()
  const history = useFireHistoryData()
  const currentCape = history.data?.latestCape ?? null

  const plan = useMemo(() => resolvePlan(inputs, baseline, currentCape), [inputs, baseline, currentCape])
  const analysis = useMemo(() => analyzePlan(inputs, plan, new Date().getFullYear()), [inputs, plan])
  const simOptions = useMemo(
    () => simOptionsForPlan(inputs, analysis.retireAge, analysis.fireNumber),
    [inputs, analysis.retireAge, analysis.fireNumber],
  )

  return {
    inputs,
    update,
    baseline,
    plan,
    analysis,
    simOptions,
    history: history.data ?? null,
    isLoading: inputsLoading || baselineLoading,
    isSaving,
  }
}

export type FirePlanState = ReturnType<typeof useFirePlan>

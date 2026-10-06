"use client"

import { useMemo } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { mix } from "@/components/plans/results/use-plan-colors"
import type { OutcomeKey } from "@/lib/plans/stress/stress-outcomes"

/**
 * Outcome colors, good to bad: green, faded green, light amber, deeper amber (out of cash), amber, red; selling the home is its own (accent)
 * case. Theme tokens, so dark mode follows.
 */
export function useOutcomeColors(): Record<OutcomeKey, string> {
  const { success, warning, error, card, primary } = useChartTheme()
  return useMemo(
    () => ({
      surplus: success,
      steady: mix(success, card, 0.5),
      justMadeIt: mix(warning, card, 0.5),
      soldHome: primary,
      outOfCash: mix(warning, card, 0.25),
      almostSurvived: warning,
      catastrophic: error,
    }),
    [success, warning, error, card, primary],
  )
}

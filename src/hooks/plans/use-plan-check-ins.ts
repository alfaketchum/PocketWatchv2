"use client"

import { useQuery } from "@tanstack/react-query"
import type { PlanCheckInRow } from "@/lib/plans/check-in/check-in-rows"
import { plansFetch, plansKeys } from "./shared"

/** Recorded monthly check-ins (plan at the time vs actual), newest first. */
export function usePlanCheckIns() {
  return useQuery({
    queryKey: plansKeys.checkIns(),
    queryFn: () => plansFetch<{ checkIns: PlanCheckInRow[] }>("/check-ins"),
    staleTime: 10 * 60_000,
  })
}

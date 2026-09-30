"use client"

import { useQuery } from "@tanstack/react-query"
import type { KnownAsset } from "@/lib/plans/plan-loan-matching"
import type { PlanDebt } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys } from "./shared"

/** Mortgages and auto loans in the user's linked accounts (as plan debts), and homes and vehicles they entered. */
export function useLinkedLoans() {
  return useQuery({
    queryKey: plansKeys.linkedLoans(),
    queryFn: () => plansFetch<{ loans: PlanDebt[]; known: KnownAsset[] }>("/linked-loans"),
    staleTime: 10 * 60_000,
  })
}

"use client"

import { useQuery } from "@tanstack/react-query"
import type { PlanDebt } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys } from "./shared"

/** Mortgages and auto loans in the user's linked accounts, as plan debts. */
export function useLinkedLoans() {
  return useQuery({
    queryKey: plansKeys.linkedLoans(),
    queryFn: () => plansFetch<{ loans: PlanDebt[] }>("/linked-loans").then((r) => r.loans),
    staleTime: 10 * 60_000,
  })
}

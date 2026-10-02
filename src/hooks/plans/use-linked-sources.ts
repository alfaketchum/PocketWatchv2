"use client"

import { useQuery } from "@tanstack/react-query"
import type { LinkedSources } from "@/lib/plans/plan-new-sources"
import { plansFetch, plansKeys } from "./shared"

/** Accounts and debts in the user's linked accounts, with when each was linked. */
export function useLinkedSources() {
  return useQuery({
    queryKey: plansKeys.linkedSources(),
    queryFn: () => plansFetch<LinkedSources>("/linked-sources"),
    staleTime: 10 * 60_000,
  })
}

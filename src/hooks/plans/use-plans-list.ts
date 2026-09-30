"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys, type PlanListItem, type PlanMeta } from "./shared"

export function usePlansList() {
  return useQuery({
    queryKey: plansKeys.list(),
    queryFn: () => plansFetch<{ plans: PlanListItem[] }>(""),
    staleTime: 60_000,
  })
}

export type CreatePlanInput =
  | { from: "blank"; name: string }
  | { from: "import"; name: string; document: PlanDocument }
  | { from: "duplicate"; name: string; sourcePlanId: string }

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePlanInput) =>
      plansFetch<{ plan: PlanMeta }>("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: plansKeys.list() }),
    onError: (err: Error) => toast.error(`Couldn't create plan: ${err.message}`),
  })
}

export function useUpdatePlanMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; isPrimary?: true }) =>
      plansFetch<{ plan: PlanMeta }>(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: plansKeys.list() })
      qc.invalidateQueries({ queryKey: plansKeys.detail(id) })
    },
    onError: (err: Error) => toast.error(`Couldn't update plan: ${err.message}`),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => plansFetch<{ ok: true }>(`/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: plansKeys.detail(id) })
      qc.invalidateQueries({ queryKey: plansKeys.list() })
    },
    onError: (err: Error) => toast.error(`Couldn't delete plan: ${err.message}`),
  })
}

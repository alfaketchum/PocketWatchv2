"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { roadmapFetch, roadmapKeys, type RoadmapItem } from "./shared"

export function useRoadmap() {
  return useQuery({
    queryKey: roadmapKeys.list(),
    queryFn: () => roadmapFetch<{ items: RoadmapItem[] }>("").then((r) => r.items),
  })
}

type Patch = Partial<Pick<RoadmapItem, "tier" | "rank" | "title" | "summary" | "demand" | "plStatus" | "ourStatus" | "effort" | "status" | "notes">>

/** Edit a feature; the list updates right away and rolls back if the save fails. */
export function useUpdateRoadmapItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) =>
      roadmapFetch<{ item: RoadmapItem }>(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: roadmapKeys.list() })
      const previous = qc.getQueryData<RoadmapItem[]>(roadmapKeys.list())
      qc.setQueryData<RoadmapItem[]>(roadmapKeys.list(), (items) => items?.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(roadmapKeys.list(), ctx.previous)
      toast.error(err.message)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: roadmapKeys.list() }),
  })
}

export function useCreateRoadmapItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; tier: RoadmapItem["tier"]; summary: string; effort: string }) =>
      roadmapFetch<{ item: RoadmapItem }>("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roadmapKeys.list() }),
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteRoadmapItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => roadmapFetch<{ ok: true }>(`/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roadmapKeys.list() }),
    onError: (err) => toast.error(err.message),
  })
}

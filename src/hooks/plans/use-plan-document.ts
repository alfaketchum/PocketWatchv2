"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { plansFetch, PlansFetchError, plansKeys, type PlanDetail, type PlanMeta } from "./shared"

const SAVE_DEBOUNCE_MS = 700
const CONFLICT_STATUS = 409

export function usePlanDetail(id: string) {
  return useQuery({
    queryKey: plansKeys.detail(id),
    queryFn: () => plansFetch<{ plan: PlanDetail }>(`/${id}`).then((r) => r.plan),
    staleTime: 5 * 60_000,
    enabled: !!id,
  })
}

export type PlanUpdater = (doc: PlanDocument) => PlanDocument

/**
 * Editable plan document. Edits apply to the cache immediately and save with a short debounce.
 * Saves run one at a time, each sending the version it edited so edits from another tab
 * surface as a conflict instead of being overwritten. Pending edits flush on unmount.
 */
export function usePlanDocument(id: string) {
  const qc = useQueryClient()
  const detail = usePlanDetail(id)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<PlanDocument | null>(null)
  const inFlight = useRef(false)
  const [isSaving, setIsSaving] = useState(false)

  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current) return
    const document = pending.current
    pending.current = null
    const expectedUpdatedAt = qc.getQueryData<PlanDetail>(plansKeys.detail(id))?.updatedAt
    inFlight.current = true
    setIsSaving(true)
    try {
      const { plan } = await plansFetch<{ plan: PlanMeta }>(`/${id}`, {
        method: "PUT",
        body: JSON.stringify({ document, expectedUpdatedAt }),
      })
      qc.setQueryData<PlanDetail>(plansKeys.detail(id), (cur) => (cur ? { ...cur, updatedAt: plan.updatedAt } : cur))
      qc.invalidateQueries({ queryKey: plansKeys.list() })
    } catch (err) {
      pending.current = null
      const conflict = err instanceof PlansFetchError && err.status === CONFLICT_STATUS
      toast.error(conflict ? (err as Error).message : `Couldn't save plan: ${(err as Error).message}`)
      qc.invalidateQueries({ queryKey: plansKeys.detail(id) })
    } finally {
      inFlight.current = false
      setIsSaving(false)
    }
    if (pending.current) void flush()
  }, [id, qc])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      void flush()
    },
    [flush],
  )

  const update = useCallback(
    (updater: PlanUpdater) => {
      const current = qc.getQueryData<PlanDetail>(plansKeys.detail(id))
      if (!current) return
      const next = updater(current.document)
      qc.setQueryData<PlanDetail>(plansKeys.detail(id), { ...current, document: next })
      pending.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    },
    [id, qc, flush],
  )

  return {
    plan: detail.data ?? null,
    document: detail.data?.document ?? null,
    update,
    isLoading: detail.isLoading,
    error: detail.error,
    isSaving,
  }
}

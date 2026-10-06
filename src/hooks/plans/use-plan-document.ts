"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { showUndoToast } from "@/components/ui/undo-toast"
import { removalLabel, removedItems } from "@/lib/plans/plan-removals"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { plansFetch, PlansFetchError, plansKeys, type PlanDetail, type PlanMeta } from "./shared"

const SAVE_DEBOUNCE_MS = 700
/** How long a removal can be undone. */
const UNDO_MS = 10_000
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
  /** The open undo toast, dismissed by the next edit: undo only ever restores the latest removal. */
  const undoToast = useRef<string | number | null>(null)
  /** The last document this hook applied. React Query stores a structurally shared copy, so compare against this. */
  const latest = useRef<PlanDocument | null>(null)

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
      // Leaving the plan ends the chance to undo: the toast would otherwise act on a page that's gone.
      if (undoToast.current !== null) toast.dismiss(undoToast.current)
      void flush()
    },
    [flush],
  )

  /** Puts `document` in the cache and saves it after the debounce. */
  const apply = useCallback(
    (current: PlanDetail, document: PlanDocument) => {
      qc.setQueryData<PlanDetail>(plansKeys.detail(id), { ...current, document })
      latest.current = document
      pending.current = document
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    },
    [id, qc, flush],
  )

  /**
   * An edit that removes things (an account, income, expense, asset, debt, milestone, child or person) offers Undo
   * for a few seconds. Undo restores the plan exactly as it was before the removal, so it's withdrawn by any later
   * edit rather than reverting that edit too. So does any edit given an `undoLabel` (Apply on the stress test).
   */
  const update = useCallback(
    (updater: PlanUpdater, opts?: { undoLabel?: string }) => {
      const current = qc.getQueryData<PlanDetail>(plansKeys.detail(id))
      if (!current) return
      const before = current.document
      const next = updater(before)
      if (undoToast.current !== null) {
        toast.dismiss(undoToast.current)
        undoToast.current = null
      }
      apply(current, next)
      const removed = removedItems(before, next)
      if (removed.length === 0 && !opts?.undoLabel) return
      const label = opts?.undoLabel ?? removalLabel(removed)
      undoToast.current = showUndoToast({
        message: opts?.undoLabel ? `Applied: ${label}` : `Removed ${label}`,
        durationMs: UNDO_MS,
        onUndo: () => {
          undoToast.current = null
          const now = qc.getQueryData<PlanDetail>(plansKeys.detail(id))
          if (!now || latest.current !== next) {
            toast.error("Couldn't undo: the plan has changed since")
            return
          }
          apply(now, before)
          toast.success(opts?.undoLabel ? "Change undone" : `Restored ${label}`)
        },
      })
    },
    [id, qc, apply],
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

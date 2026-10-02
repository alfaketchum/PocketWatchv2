"use client"

import { useCallback, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { DollarBasis } from "@/lib/plans/plan-types"
import { usePlanDetail } from "./use-plan-document"
import { usePlanProjection } from "./use-plan-projection"
import { usePlansList } from "./use-plans-list"

/**
 * Plan A and plan B for Compare: which two (kept in `?a=&b=` so a comparison can be linked), both documents and
 * both projections on one dollar basis. Defaults to the primary plan against the next one.
 */
export function useComparePlans() {
  const list = usePlansList()
  const plans = useMemo(() => list.data?.plans ?? [], [list.data])
  const pathname = usePathname()
  const params = useSearchParams()
  const [picked, setPicked] = useState<{ a: string | null; b: string | null }>(() => ({ a: params.get("a"), b: params.get("b") }))
  const exists = (id: string | null) => !!id && plans.some((p) => p.id === id)
  const aId = exists(picked.a) ? picked.a! : (plans[0]?.id ?? "")
  const bId = exists(picked.b) && picked.b !== aId ? picked.b! : (plans.find((p) => p.id !== aId)?.id ?? "")

  const pick = useCallback(
    (a: string, b: string) => {
      setPicked({ a, b })
      window.history.replaceState(window.history.state, "", `${pathname}?a=${a}&b=${b}`)
    },
    [pathname],
  )
  // Choosing the other side's plan swaps the two, so A and B are never the same plan.
  const setA = useCallback((id: string) => (id === bId ? pick(id, aId) : pick(id, bId)), [aId, bId, pick])
  const setB = useCallback((id: string) => (id === aId ? pick(bId, id) : pick(aId, id)), [aId, bId, pick])
  const swap = useCallback(() => pick(bId, aId), [aId, bId, pick])

  const [basis, setBasis] = useState<DollarBasis>("today")
  const detailA = usePlanDetail(aId)
  const detailB = usePlanDetail(bId)
  const a = usePlanProjection(detailA.data?.document ?? null, basis)
  const b = usePlanProjection(detailB.data?.document ?? null, basis)

  return {
    plans,
    isLoading: list.isLoading || detailA.isLoading || detailB.isLoading,
    error: list.error ?? detailA.error ?? detailB.error,
    aId,
    bId,
    setA,
    setB,
    swap,
    basis,
    setBasis,
    a: { plan: detailA.data ?? null, ...a },
    b: { plan: detailB.data ?? null, ...b },
  }
}

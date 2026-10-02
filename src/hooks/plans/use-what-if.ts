"use client"

import { useCallback, useDeferredValue, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { applyWhatIf, whatIfFromQuery, whatIfToQuery, type WhatIf } from "@/lib/plans/plan-what-if"
import type { DollarBasis } from "@/lib/plans/plan-types"
import { usePlanDetail } from "./use-plan-document"
import { usePlanProjection } from "./use-plan-projection"

/**
 * A plan against a tweaked copy of itself. The dials live in the URL (so a what-if can be linked or reloaded); the
 * plan is only read, never saved. Projections follow the dials a beat behind so dragging stays smooth.
 */
export function useWhatIf(planId: string) {
  const detail = usePlanDetail(planId)
  const pathname = usePathname()
  const params = useSearchParams()
  const [dials, setDialsState] = useState<WhatIf>(() => whatIfFromQuery(new URLSearchParams(params.toString())))
  const setDials = useCallback(
    (next: WhatIf) => {
      setDialsState(next)
      const query = whatIfToQuery(next).toString()
      window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname)
    },
    [pathname],
  )
  const deferred = useDeferredValue(dials)
  const base = detail.data?.document ?? null
  const whatIfDoc = useMemo(() => (base ? applyWhatIf(base, deferred) : null), [base, deferred])

  const [basis, setBasis] = useState<DollarBasis>("today")
  const a = usePlanProjection(base, basis)
  const b = usePlanProjection(whatIfDoc, basis)
  return { plan: detail.data ?? null, isLoading: detail.isLoading, error: detail.error, dials, setDials, whatIfDoc, basis, setBasis, a, b }
}

"use client"

import { useCallback, useEffect, useState } from "react"
import type { PlanMode } from "@/lib/plans/plan-mode"
import { usePlansList } from "./use-plans-list"

/** Remembered per browser, for every plan. */
const STORAGE_KEY = "pw-plan-mode"
// Same-tab broadcast so the header, tabs and every panel switch together; "storage" only fires in other tabs.
const EVENT = "pw-plan-mode-change"

function readMode(): PlanMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "basic" || saved === "advanced" ? saved : null
  } catch {
    return null
  }
}

function writeMode(mode: PlanMode) {
  try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* private mode: stays for this visit */ }
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: mode })) } catch { /* ignore */ }
}

/**
 * The planner's Basic/Advanced view. With nothing saved yet, someone who already has plans starts in Advanced (so
 * nothing they use disappears) and a newcomer in Basic; that first choice is saved. Shows Advanced until known.
 */
export function usePlanMode() {
  const [saved, setSaved] = useState<PlanMode | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setSaved(readMode())
    setChecked(true)
    const sync = (e: Event) => setSaved(e instanceof CustomEvent && (e.detail === "basic" || e.detail === "advanced") ? e.detail : readMode())
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const needsDefault = checked && saved === null
  const plans = usePlansList({ enabled: needsDefault })
  const plansKnown = needsDefault && plans.isSuccess
  const hasPlans = (plans.data?.plans.length ?? 0) > 0
  useEffect(() => {
    if (plansKnown) writeMode(hasPlans ? "advanced" : "basic")
  }, [plansKnown, hasPlans])

  const setMode = useCallback((next: PlanMode) => {
    setSaved(next)
    writeMode(next)
  }, [])

  const mode: PlanMode = saved ?? "advanced"
  return { mode, setMode, isBasic: mode === "basic", ready: saved !== null } as const
}

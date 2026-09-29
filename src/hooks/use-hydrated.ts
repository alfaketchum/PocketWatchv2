"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False on the server and during hydration, true afterwards. Pages whose React Query data can
 * already be cached before hydration (layout prefetches, the sidebar) should ignore that data
 * until hydrated, so the first client render matches the server's loading state.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

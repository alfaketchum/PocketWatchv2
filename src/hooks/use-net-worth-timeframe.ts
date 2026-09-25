"use client"

import { useState, useEffect, useCallback } from "react"

/** Net-worth lookback windows (sidebar + page share the selection). */
export const NET_WORTH_TIMEFRAMES = [
  { key: "D", label: "D", days: 1 },
  { key: "W", label: "W", days: 7 },
  { key: "M", label: "M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "ALL", days: Number.POSITIVE_INFINITY },
] as const

export type NetWorthTf = (typeof NET_WORTH_TIMEFRAMES)[number]["key"]

/** The compact sidebar widget only offers the short windows. */
export const SIDEBAR_TIMEFRAMES = NET_WORTH_TIMEFRAMES.filter((t) => ["D", "W", "M", "3M"].includes(t.key))

const TF_KEY = "pw-networth-tf"

export function daysForTf(tf: NetWorthTf): number {
  return NET_WORTH_TIMEFRAMES.find((t) => t.key === tf)?.days ?? 30
}

interface TimeframeOptions {
  /** Starting selection (default "M") */
  initial?: NetWorthTf
  /** Restore the saved selection on mount (default true). Selecting always saves. */
  restoreSaved?: boolean
}

/**
 * Net-worth lookback, shared across the sidebar and page via one localStorage
 * key so the toggle selection carries everywhere.
 */
export function useNetWorthTimeframe({ initial = "M", restoreSaved = true }: TimeframeOptions = {}) {
  const [tf, setTf] = useState<NetWorthTf>(initial)

  useEffect(() => {
    if (!restoreSaved) return
    try {
      const v = localStorage.getItem(TF_KEY)
      if (v && NET_WORTH_TIMEFRAMES.some((t) => t.key === v)) setTf(v as NetWorthTf)
    } catch { /* ignore */ }
  }, [restoreSaved])

  const select = useCallback((k: NetWorthTf) => {
    setTf(k)
    try { localStorage.setItem(TF_KEY, k) } catch { /* ignore */ }
  }, [])

  return { tf, select }
}

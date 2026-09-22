"use client"

import { useState, useEffect, useCallback } from "react"

/** Shared net-worth change lookback windows (sidebar + page stay in sync). */
export const NET_WORTH_TIMEFRAMES = [
  { key: "D", label: "D", days: 1 },
  { key: "W", label: "W", days: 7 },
  { key: "M", label: "M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
] as const

export type NetWorthTf = (typeof NET_WORTH_TIMEFRAMES)[number]["key"]

const TF_KEY = "pw-networth-tf"

export function daysForTf(tf: NetWorthTf): number {
  return NET_WORTH_TIMEFRAMES.find((t) => t.key === tf)?.days ?? 30
}

/**
 * Persistent net-worth lookback, shared across the sidebar and page via one
 * localStorage key so the toggle selection carries everywhere.
 */
export function useNetWorthTimeframe() {
  const [tf, setTf] = useState<NetWorthTf>("M")

  useEffect(() => {
    try {
      const v = localStorage.getItem(TF_KEY)
      if (v && NET_WORTH_TIMEFRAMES.some((t) => t.key === v)) setTf(v as NetWorthTf)
    } catch { /* ignore */ }
  }, [])

  const select = useCallback((k: NetWorthTf) => {
    setTf(k)
    try { localStorage.setItem(TF_KEY, k) } catch { /* ignore */ }
  }, [])

  return { tf, select }
}

"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "pw-sidebar-collapsed"

/**
 * Desktop sidebar collapse state, persisted to localStorage.
 * SSR-safe: defaults to expanded, then hydrates from storage after mount.
 * Only meaningful at the lg breakpoint (below that the mobile drawer / tablet
 * rail take over, and the collapsed styling is lg-scoped in the sidebar).
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // localStorage unavailable — stay expanded
    }
    setHydrated(true)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        // quota / unavailable — ignore
      }
      return next
    })
  }, [])

  return { collapsed, toggle, hydrated }
}

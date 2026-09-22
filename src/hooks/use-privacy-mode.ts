"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "privacyMode"
// Same-tab broadcast so every hook instance (sidebar, page headers, …) stays in
// sync the moment the toggle is pressed — the native "storage" event only fires
// in other tabs.
const EVENT = "pw-privacy-change"

export function usePrivacyMode() {
  const [isHidden, setIsHidden] = useState(false)

  // Hydrate from localStorage after mount (avoids SSR mismatch) and subscribe to
  // changes from other instances/tabs.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setIsHidden(true)
    } catch {
      // localStorage unavailable (SSR, private browsing)
    }

    const sync = (e: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === "boolean") {
        setIsHidden(e.detail)
        return
      }
      try { setIsHidden(localStorage.getItem(STORAGE_KEY) === "true") } catch { /* ignore */ }
    }

    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const togglePrivacy = useCallback(() => {
    setIsHidden((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent(EVENT, { detail: next })) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { isHidden, togglePrivacy } as const
}

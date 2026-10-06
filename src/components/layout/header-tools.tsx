"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** The spot in the top bar (left, level with the light/dark and privacy controls) where a page can put its own tools. */
export const HEADER_TOOLS_ID = "header-page-tools"

/** Renders a page's tools in the top bar; inline where there's no top bar to hold them. */
export function HeaderTools({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    setSlot(document.getElementById(HEADER_TOOLS_ID))
    setChecked(true)
  }, [])
  if (slot) return createPortal(children, slot)
  return checked ? <>{children}</> : null
}

"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** A toolbar group in the top bar, boxed like the light/dark and privacy controls. */
export const TOOLBAR_CLASS = "inline-flex items-center gap-0.5 rounded-xl border border-card-border bg-card p-0.5"

/** A square icon button inside a toolbar group, the size of the light/dark button. */
export const TOOLBAR_BUTTON_CLASS =
  "flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"

/**
 * Spots in the top bar, level with the light/dark and privacy controls, where a page can put its own controls: its
 * tools on the left, and its section tabs centered between those and the controls on the right (wide screens).
 */
export const HEADER_TOOLS_ID = "header-page-tools"
export const HEADER_NAV_ID = "header-page-nav"

/** Renders a page's tools (or, with `slot="nav"`, its tabs) in the top bar; inline where there's no top bar to hold them. */
export function HeaderTools({ children, slot: target = "tools" }: { children: ReactNode; slot?: "tools" | "nav" }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    setSlot(document.getElementById(target === "nav" ? HEADER_NAV_ID : HEADER_TOOLS_ID))
    setChecked(true)
  }, [target])
  if (slot) return createPortal(children, slot)
  return checked ? <>{children}</> : null
}

"use client"

import { useEffect, useState, type ReactNode } from "react"
import { PlanEditorTabs, type PlanTab } from "./plan-editor-tabs"

/** Remembered per browser: whether the tab content is open. Collapsed until opened. */
const OPEN_KEY = "pw-plan-editor-open"

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * The plan's tabs and the content they control in one panel; the content folds away to bring the chart up. Folded,
 * the panel is only as wide as its tabs, centered; open, it takes the full width with the tabs centered on top.
 */
export function PlanEditorPanel({ tab, onTabChange, children }: { tab: PlanTab; onTabChange: (tab: PlanTab) => void; children: ReactNode }) {
  const [open, setOpenState] = useState(false)
  useEffect(() => setOpenState(readOpen()), [])
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0")
    } catch {
      /* private mode: stays for this visit */
    }
  }
  return (
    <section
      className={`bg-card border border-card-border rounded-2xl ${open ? "" : "w-full sm:mx-auto sm:w-fit sm:max-w-full"}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className={`flex items-stretch justify-between gap-1 pl-1 pr-2 sm:justify-center sm:gap-2 sm:px-4 ${open ? "border-b border-card-border" : ""}`}>
        <div className="min-w-0">
          <PlanEditorTabs value={tab} onChange={onTabChange} open={open} onToggle={() => setOpen(!open)} />
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Collapse" : "Expand"}
            className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 lg:h-8 lg:min-w-0"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
              {open ? "remove" : "add"}
            </span>
            <span className="hidden sm:inline">{open ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>
      {/* Hidden, not unmounted, when collapsed: expanding is instant. */}
      <div hidden={!open} className="space-y-4 p-4 sm:p-6">
        {children}
      </div>
    </section>
  )
}

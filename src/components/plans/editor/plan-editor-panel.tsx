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

/** The plan's tabs and the content they control in one panel; the content folds away to bring the chart up. */
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
  const pick = (next: PlanTab) => {
    onTabChange(next)
    if (!open) setOpen(true)
  }
  return (
    <section className="bg-card border border-card-border rounded-2xl" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className={`flex items-stretch gap-2 px-2 sm:px-4 ${open ? "border-b border-card-border" : ""}`}>
        <div className="min-w-0 flex-1">
          <PlanEditorTabs value={tab} onChange={pick} open={open} onToggle={() => setOpen(!open)} />
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
              {open ? "expand_less" : "expand_more"}
            </span>
            {open ? "Collapse" : "Expand"}
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

"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** Plan page order: the tabs panel above the chart, or the chart first. */
export type PlanLayout = "tabsFirst" | "chartFirst"

const LAYOUT_KEY = "pw-plan-layout"

const OPTIONS: { value: PlanLayout; label: string; icon: string; hint: string }[] = [
  { value: "tabsFirst", label: "Tabs first", icon: "vertical_align_top", hint: "Tabs and their content above the chart" },
  { value: "chartFirst", label: "Chart first", icon: "bar_chart", hint: "The chart above the tabs" },
]

/** Tabs first until you switch, then remembered in this browser. */
export function usePlanLayout(): [PlanLayout, (layout: PlanLayout) => void] {
  const [layout, setLayout] = useState<PlanLayout>("tabsFirst")
  useEffect(() => {
    try {
      if (localStorage.getItem(LAYOUT_KEY) === "chartFirst") setLayout("chartFirst")
    } catch {
      // Storage can be unavailable (private mode); the default still works.
    }
  }, [])
  const change = (next: PlanLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
  return [layout, change]
}

/** Layout switch beside the dollars toggle: tabs above the chart, or the chart first. */
export function PlanLayoutToggle({ value, onChange }: { value: PlanLayout; onChange: (layout: PlanLayout) => void }) {
  return (
    <div role="radiogroup" aria-label="Page layout" className="inline-flex rounded-lg border border-card-border p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === o.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
            {o.icon}
          </span>
          {o.label}
        </button>
      ))}
    </div>
  )
}

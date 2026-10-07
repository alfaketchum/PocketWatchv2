"use client"

import { cn } from "@/lib/utils"
import { STRESS_TABS, type StressTab } from "./stress-tab-names"

/** The stress test's tab strip, styled like the plan editor's; on a phone only the active tab shows its label. */
export function StressTabs({ value, onChange }: { value: StressTab; onChange: (tab: StressTab) => void }) {
  return (
    <nav className="flex overflow-x-auto border-b border-card-border scrollbar-hide" role="tablist" aria-label="Stress test sections">
      {STRESS_TABS.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors md:min-h-0",
              active ? "border-b-primary font-medium text-primary" : "border-b-transparent text-foreground-muted hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
              {tab.icon}
            </span>
            <span className={active ? undefined : "hidden sm:inline"}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

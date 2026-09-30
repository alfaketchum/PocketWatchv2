"use client"

import { cn } from "@/lib/utils"

export type PlanTab = "overview" | "accounts" | "income" | "expenses" | "cashflow" | "settings"

export const PLAN_TABS: { value: PlanTab; label: string; icon: string }[] = [
  { value: "overview", label: "Overview", icon: "insights" },
  { value: "accounts", label: "Accounts", icon: "account_balance" },
  { value: "income", label: "Income", icon: "payments" },
  { value: "expenses", label: "Expenses", icon: "shopping_cart" },
  { value: "cashflow", label: "Cash flow", icon: "swap_vert" },
  { value: "settings", label: "Settings", icon: "tune" },
]

export function isPlanTab(value: string | null): value is PlanTab {
  return PLAN_TABS.some((t) => t.value === value)
}

/** Editor section tabs for a plan. */
export function PlanEditorTabs({ value, onChange }: { value: PlanTab; onChange: (tab: PlanTab) => void }) {
  return (
    <nav className="flex border-b border-card-border overflow-x-auto scrollbar-hide" role="tablist">
      {PLAN_TABS.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap text-sm transition-colors",
              active ? "text-primary border-b-primary font-medium" : "text-foreground-muted border-b-transparent hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

"use client"

import { cn } from "@/lib/utils"

export type PlanTab = "assumptions" | "milestones" | "accounts" | "income" | "expenses" | "assets" | "cashflow" | "overview"

/** In the order you'd build a plan: assumptions first, then your money, the timeline of life events, and results last. */
export const PLAN_TABS: { value: PlanTab; label: string; icon: string }[] = [
  { value: "assumptions", label: "Assumptions", icon: "tune" },
  { value: "accounts", label: "Accounts", icon: "account_balance" },
  { value: "income", label: "Income", icon: "payments" },
  { value: "expenses", label: "Expenses", icon: "shopping_cart" },
  { value: "assets", label: "Assets & debts", icon: "home" },
  { value: "cashflow", label: "Cash flow", icon: "swap_vert" },
  { value: "milestones", label: "Milestones", icon: "flag" },
  { value: "overview", label: "Ledger Overview", icon: "insights" },
]

export const DEFAULT_PLAN_TAB: PlanTab = "assumptions"

/** Old links used ?tab=settings. */
const TAB_ALIASES: Record<string, PlanTab> = { settings: "assumptions" }

/** The tab a ?tab= value points at, falling back to the first tab. */
export function planTabFrom(value: string | null): PlanTab {
  const tab = value ? (TAB_ALIASES[value] ?? value) : null
  return isPlanTab(tab) ? tab : DEFAULT_PLAN_TAB
}

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
              "flex items-center gap-2 px-3 py-3 border-b-2 whitespace-nowrap text-sm transition-colors",
              active ? "text-primary border-b-primary font-medium" : "text-foreground-muted border-b-transparent hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

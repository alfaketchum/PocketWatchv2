"use client"

import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { BASIC_TABS } from "@/lib/plans/plan-mode"
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

/**
 * Editor section tabs for a plan. With `open` set, clicking the selected tab again folds its content (`onToggle`),
 * and the selected tab shows which way it will go.
 */
export function PlanEditorTabs({
  value,
  onChange,
  open,
  onToggle,
}: {
  value: PlanTab
  onChange: (tab: PlanTab) => void
  open?: boolean
  onToggle?: () => void
}) {
  const { isBasic } = usePlanMode()
  const tabs = isBasic ? PLAN_TABS.filter((t) => BASIC_TABS.includes(t.value)) : PLAN_TABS
  return (
    <nav className="flex -mb-px overflow-x-auto scrollbar-hide" role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-expanded={active && onToggle ? open : undefined}
            title={active && onToggle ? (open ? "Click to collapse" : "Click to expand") : undefined}
            onClick={() => (active && onToggle ? onToggle() : onChange(tab.value))}
            className={cn(
              "flex items-center gap-2 px-3 py-3 border-b-2 whitespace-nowrap text-sm transition-colors",
              active ? "text-primary border-b-primary font-medium" : "text-foreground-muted border-b-transparent hover:text-foreground",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
            {active && onToggle && (
              <span
                className="material-symbols-rounded inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-primary/10"
                style={{ fontSize: 16 }}
                aria-hidden="true"
              >
                {open ? "remove" : "add"}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

"use client"

import { cn } from "@/lib/utils"
import type { BuildTab, TabStatus } from "@/lib/plans/plan-tab-status"

export type PlanTab = BuildTab

/** In the order you'd build a plan. Results (ledger, money flow, loans…) are pages of their own. */
export const PLAN_TABS: { value: PlanTab; label: string; icon: string }[] = [
  { value: "assumptions", label: "Assumptions", icon: "tune" },
  { value: "accounts", label: "Accounts", icon: "account_balance" },
  { value: "income", label: "Income", icon: "payments" },
  { value: "expenses", label: "Expenses", icon: "shopping_cart" },
  { value: "assets", label: "Assets & debts", icon: "home" },
  { value: "cashflow", label: "Cash flow", icon: "swap_vert" },
  { value: "milestones", label: "Milestones", icon: "flag" },
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

const DOT: Record<TabStatus["state"], string> = {
  empty: "border border-foreground-muted/60",
  filled: "bg-success/70",
  attention: "bg-warning",
}
const STATE_LABEL: Record<TabStatus["state"], string> = { empty: "Empty", filled: "Filled in", attention: "Needs attention" }

/** A tiny mark on a tab: hollow while empty, green once filled in, amber when something needs fixing. */
function StatusDot({ status }: { status: TabStatus }) {
  return (
    <span title={`${STATE_LABEL[status.state]}: ${status.note}`} className="inline-flex">
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", DOT[status.state])} />
      <span className="sr-only">
        {STATE_LABEL[status.state]}: {status.note}
      </span>
    </span>
  )
}

/** Editor section tabs for a plan, each with its status. */
export function PlanEditorTabs({
  value,
  onChange,
  statuses,
}: {
  value: PlanTab
  onChange: (tab: PlanTab) => void
  statuses: Record<PlanTab, TabStatus>
}) {
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
            <StatusDot status={statuses[tab.value]} />
          </button>
        )
      })}
    </nav>
  )
}

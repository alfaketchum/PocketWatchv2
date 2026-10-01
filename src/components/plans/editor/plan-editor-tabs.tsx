"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"

export type PlanTab = "assumptions" | "milestones" | "accounts" | "income" | "expenses" | "assets" | "cashflow" | "overview"

/**
 * In the order you'd build a plan, numbered as steps: assumptions, then the life story (milestones, which fill in
 * later steps and which they point at), then today's money, and the ledger of results last.
 */
export const PLAN_TABS: { value: PlanTab; label: string }[] = [
  { value: "assumptions", label: "Assumptions" },
  { value: "milestones", label: "Milestones" },
  { value: "accounts", label: "Accounts" },
  { value: "income", label: "Income" },
  { value: "expenses", label: "Expenses" },
  { value: "assets", label: "Assets & debts" },
  { value: "cashflow", label: "Cash flow" },
  { value: "overview", label: "Ledger Overview" },
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

/** The step's number in a small circle, filled for the tab you're on. */
function StepNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
        active ? "bg-primary text-white" : "border border-card-border text-foreground-muted",
      )}
    >
      {n}
    </span>
  )
}

/** Editor section tabs for a plan as numbered steps. */
export function PlanEditorTabs({ value, onChange }: { value: PlanTab; onChange: (tab: PlanTab) => void }) {
  return (
    <nav className="flex border-b border-card-border overflow-x-auto scrollbar-hide" role="tablist">
      {PLAN_TABS.map((tab, i) => {
        const active = tab.value === value
        return (
          <Fragment key={tab.value}>
            {i > 0 && (
              <span aria-hidden="true" className="material-symbols-rounded self-center text-foreground-muted/50" style={{ fontSize: 12 }}>
                arrow_forward
              </span>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-1 py-3 border-b-2 whitespace-nowrap text-[13px] transition-colors",
                active ? "text-primary border-b-primary font-medium" : "text-foreground-muted border-b-transparent hover:text-foreground",
              )}
            >
              <StepNumber n={i + 1} active={active} />
              <span className="sr-only">Step {i + 1}:</span>
              {tab.label}
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}

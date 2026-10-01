"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"
import type { BuildTab, TabStatus } from "@/lib/plans/plan-tab-status"

export type PlanTab = BuildTab | "overview"

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

/** Editor section tabs for a plan as numbered steps, each build step with its status. */
export function PlanEditorTabs({
  value,
  onChange,
  statuses,
}: {
  value: PlanTab
  onChange: (tab: PlanTab) => void
  statuses: Record<BuildTab, TabStatus>
}) {
  return (
    <nav className="flex border-b border-card-border overflow-x-auto scrollbar-hide" role="tablist">
      {PLAN_TABS.map((tab, i) => {
        const active = tab.value === value
        const status = tab.value === "overview" ? null : statuses[tab.value]
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
              {status && <StatusDot status={status} />}
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}

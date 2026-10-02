"use client"

import { cn } from "@/lib/utils"
import { BASIC_CHART_VIEWS } from "@/lib/plans/plan-mode"
import type { ChartMode } from "./use-chart-series"

export const MODES: { value: ChartMode; label: string }[] = [
  { value: "networth", label: "Net worth" },
  { value: "cashflow", label: "Cash flow" },
  { value: "income", label: "Income" },
  { value: "expenses", label: "Expenses" },
  { value: "debt", label: "Debt" },
  { value: "taxes", label: "Taxes" },
  { value: "accounts", label: "Accounts" },
]

/** The chart views offered: Debt only with debt, and Basic's short list. */
export function chartModes(hasDebt: boolean, basic: boolean): ChartMode[] {
  const all: ChartMode[] = ["networth", "cashflow", "income", "expenses", ...(hasDebt ? (["debt"] as const) : []), "taxes", "accounts"]
  return basic ? all.filter((m) => BASIC_CHART_VIEWS.includes(m)) : all
}

/** Right-aligned switch: split each band into its accounts, assets, loans, incomes, spending lines… */
export function DetailToggle({ checked, onChange, label = "Subcategories" }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[11px] font-medium text-foreground-muted hover:text-foreground"
    >
      {label}
      <span className={cn("relative inline-block h-4 w-7 rounded-full transition-colors", checked ? "bg-primary" : "bg-foreground/15")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", checked ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  )
}

export function ModeToggle({ value, onChange, modes }: { value: ChartMode; onChange: (mode: ChartMode) => void; modes: ChartMode[] }) {
  return (
    <div role="radiogroup" aria-label="Chart view" className="inline-flex rounded-lg border border-card-border p-0.5">
      {MODES.filter((m) => modes.includes(m.value)).map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === m.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

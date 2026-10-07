"use client"

import { HoverHint } from "@/components/ui/hover-hint"
import { cn } from "@/lib/utils"
import { BASIC_CHART_VIEWS } from "@/lib/plans/plan-mode"
import type { ChartMode } from "./use-chart-series"

export const MODES: { value: ChartMode; label: string; hint: string }[] = [
  { value: "networth", label: "Net worth", hint: "Everything you own minus everything you owe, by year." },
  { value: "cashflow", label: "Cash flow", hint: "Money coming in each year and where it goes." },
  { value: "income", label: "Income", hint: "Pay, Social Security and other income, by year." },
  { value: "expenses", label: "Expenses", hint: "Spending by category, by year." },
  { value: "debt", label: "Debt", hint: "What you still owe on each loan, by year." },
  { value: "taxes", label: "Taxes", hint: "Taxes owed each year, by type." },
  { value: "accounts", label: "Accounts", hint: "The balance of each savings and investment account, by year." },
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
      className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-foreground-muted hover:text-foreground lg:min-h-0 lg:text-[11px]"
    >
      {label}
      <span className={cn("relative inline-block h-4 w-7 rounded-full transition-colors", checked ? "bg-primary" : "bg-foreground/15")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", checked ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  )
}

/** A chart's view switch: one bordered strip of options, the chosen one filled; scrolls sideways on a phone. */
export function SegmentedToggle<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="scrollbar-hide inline-flex max-w-full overflow-x-auto rounded-lg border border-card-border p-0.5">
      {options.map((m) => (
        <HoverHint key={m.value} hint={m.hint}>
          <button
            type="button"
            role="radio"
            aria-checked={value === m.value}
            onClick={() => onChange(m.value)}
            className={cn(
              "min-h-9 shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors lg:min-h-0 lg:px-2.5 lg:text-[11px]",
              value === m.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        </HoverHint>
      ))}
    </div>
  )
}

/** Seven views don't fit a phone's width: the strip scrolls sideways there instead of being cut off. */
export function ModeToggle({ value, onChange, modes }: { value: ChartMode; onChange: (mode: ChartMode) => void; modes: ChartMode[] }) {
  return <SegmentedToggle label="Chart view" value={value} onChange={onChange} options={MODES.filter((m) => modes.includes(m.value))} />
}

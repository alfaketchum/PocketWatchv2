import { cn } from "@/lib/utils"
import { BUDGET_LOOKBACK_OPTIONS, type BudgetLookback } from "@/lib/finance/budget-builder-config"
import type { BuilderMethod } from "./budget-builder-types"

interface MethodOption {
  method: BuilderMethod
  icon: string
  title: string
  description: (months: number) => string
}

const METHODS: MethodOption[] = [
  {
    method: "ai",
    icon: "auto_awesome",
    title: "AI budget",
    description: (n) => `AI reviews ${n} months of lifestyle spending, down to subcategories, plus subscriptions and your current budgets. It proposes a budget you can accept, edit or reject. Taxes are left out.`,
  },
  {
    method: "simple",
    icon: "tune",
    title: "Set a total",
    description: (n) => `Pick one monthly number and split it with sliders, pre-filled from your last ${n} months of spending.`,
  },
  {
    method: "manual",
    icon: "edit_note",
    title: "Manual",
    description: (n) => `Set an amount for each category yourself, with your ${n}-month averages shown as a guide.`,
  },
]

interface BudgetBuilderMethodPickerProps {
  hasBudgets: boolean
  providerLabel: string | null
  lookback: BudgetLookback
  onLookbackChange: (months: BudgetLookback) => void
  /** Complete months of history actually available in the window (null while loading). */
  monthsAvailable: number | null
  onPick: (method: BuilderMethod) => void
}

export function BudgetBuilderMethodPicker({ hasBudgets, providerLabel, lookback, onLookbackChange, monthsAvailable, onPick }: BudgetBuilderMethodPickerProps) {
  const effective = monthsAvailable != null && monthsAvailable > 0 ? Math.min(monthsAvailable, lookback) : lookback
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Look back</span>
        <div role="radiogroup" aria-label="Lookback period" className="inline-flex bg-background-secondary border border-card-border rounded-lg p-0.5">
          {BUDGET_LOOKBACK_OPTIONS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={lookback === m}
              onClick={() => onLookbackChange(m)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md tabular-nums transition-colors",
                lookback === m ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {m}m
            </button>
          ))}
        </div>
        {monthsAvailable != null && monthsAvailable < lookback && (
          <span className="text-[11px] text-warning">Only {monthsAvailable} months of history available</span>
        )}
      </div>
      <p className="text-sm text-foreground-muted">
        {hasBudgets
          ? "Every option starts from your current budgets. Nothing is removed unless you remove it, and you'll review the changes before saving."
          : "How do you want to build your budget?"}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {METHODS.map((m) => (
          <button
            key={m.method}
            onClick={() => onPick(m.method)}
            disabled={monthsAvailable == null}
            className={cn(
              "group text-left disabled:opacity-60 disabled:cursor-wait rounded-2xl border border-card-border bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5",
              m.method === "ai" && "border-primary/40",
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }} aria-hidden="true">{m.icon}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{m.title}</p>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{m.description(effective)}</p>
            {m.method === "ai" && providerLabel && (
              <p className="text-[10px] text-foreground-muted mt-3">Uses {providerLabel}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

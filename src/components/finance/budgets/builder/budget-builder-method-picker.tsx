import { cn } from "@/lib/utils"
import type { BuilderMethod } from "./budget-builder-types"

interface MethodOption {
  method: BuilderMethod
  icon: string
  title: string
  description: string
}

const METHODS: MethodOption[] = [
  {
    method: "ai",
    icon: "auto_awesome",
    title: "AI budget",
    description: "AI reviews 6 months of spending, income, subscriptions and your current budgets, then proposes a full budget you can adjust.",
  },
  {
    method: "simple",
    icon: "tune",
    title: "Set a total",
    description: "Pick one monthly number and split it with sliders, pre-filled from how you actually spend.",
  },
  {
    method: "manual",
    icon: "edit_note",
    title: "Manual",
    description: "Set an amount for each category yourself, with your averages shown as a guide.",
  },
]

interface BudgetBuilderMethodPickerProps {
  hasBudgets: boolean
  providerLabel: string | null
  onPick: (method: BuilderMethod) => void
}

export function BudgetBuilderMethodPicker({ hasBudgets, providerLabel, onPick }: BudgetBuilderMethodPickerProps) {
  return (
    <div className="space-y-4">
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
            className={cn(
              "group text-left rounded-2xl border border-card-border bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5",
              m.method === "ai" && "border-primary/40",
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }} aria-hidden="true">{m.icon}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{m.title}</p>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{m.description}</p>
            {m.method === "ai" && providerLabel && (
              <p className="text-[10px] text-foreground-muted mt-3">Uses {providerLabel}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

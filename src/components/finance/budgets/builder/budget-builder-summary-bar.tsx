import { formatCurrency, cn } from "@/lib/utils"

interface BudgetBuilderSummaryBarProps {
  total: number
  income: number
  typicalSpend: number
}

/** Total budgeted vs average income and historical spend. */
export function BudgetBuilderSummaryBar({ total, income, typicalSpend }: BudgetBuilderSummaryBarProps) {
  const left = income - total
  const pctOfIncome = income > 0 ? (total / income) * 100 : null
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Budgeted" value={formatCurrency(total, "USD", 0)} sub={pctOfIncome != null ? `${pctOfIncome.toFixed(0)}% of income` : "per month"} />
      <Stat label="Avg income" value={income > 0 ? formatCurrency(income, "USD", 0) : "—"} sub={income > 0 ? "per month" : "no income data"} />
      <Stat
        label={left >= 0 ? "Left to save" : "Over income"}
        value={income > 0 ? formatCurrency(Math.abs(left), "USD", 0) : "—"}
        sub={typicalSpend > 0 ? `typical month ${formatCurrency(typicalSpend, "USD", 0)}` : ""}
        tone={income > 0 ? (left >= 0 ? "good" : "bad") : undefined}
      />
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-background-secondary border border-card-border px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted truncate">{label}</p>
      <p className={cn("text-base font-bold tabular-nums truncate", tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-foreground")}>{value}</p>
      <p className="text-[10px] text-foreground-muted truncate">{sub}</p>
    </div>
  )
}

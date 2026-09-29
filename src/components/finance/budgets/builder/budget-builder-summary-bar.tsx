import { formatCurrency, cn } from "@/lib/utils"

interface BudgetBuilderSummaryBarProps {
  total: number
  typicalSpend: number
  /** Monthly income when it's steady (paycheck-like); null for variable income. */
  steadyIncome: number | null
}

/** Total budgeted vs a typical month of lifestyle spend — and vs income when income is steady. */
export function BudgetBuilderSummaryBar({ total, typicalSpend, steadyIncome }: BudgetBuilderSummaryBarProps) {
  const diff = total - typicalSpend
  const pct = typicalSpend > 0 ? (diff / typicalSpend) * 100 : null
  const left = steadyIncome != null ? steadyIncome - total : null
  return (
    <div className={cn("grid gap-2", left != null ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
      <Stat label="Budgeted" value={formatCurrency(total, "USD", 0)} sub="per month" />
      <Stat label="Typical month" value={typicalSpend > 0 ? formatCurrency(typicalSpend, "USD", 0) : "—"} sub="lifestyle spend (median)" />
      <Stat
        label={diff >= 0 ? "Above typical" : "Below typical"}
        value={typicalSpend > 0 ? formatCurrency(Math.abs(diff), "USD", 0) : "—"}
        sub={pct != null ? `${diff >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}% vs typical` : ""}
        tone={typicalSpend > 0 && diff < 0 ? "warn" : undefined}
      />
      {left != null && steadyIncome != null && (
        <Stat
          label={left >= 0 ? "Left to save" : "Over income"}
          value={formatCurrency(Math.abs(left), "USD", 0)}
          sub={`of ${formatCurrency(steadyIncome, "USD", 0)} income`}
          tone={left >= 0 ? "good" : "bad"}
        />
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-error" : tone === "warn" ? "text-warning" : "text-foreground"
  return (
    <div className="rounded-xl bg-background-secondary border border-card-border px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted truncate">{label}</p>
      <p className={cn("text-base font-bold tabular-nums truncate", color)}>{value}</p>
      <p className="text-[10px] text-foreground-muted truncate">{sub}</p>
    </div>
  )
}

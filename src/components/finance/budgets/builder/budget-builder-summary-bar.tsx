import { formatCurrency, cn } from "@/lib/utils"

interface BudgetBuilderSummaryBarProps {
  total: number
  typicalSpend: number
}

/** Total budgeted vs what a typical month of lifestyle spending actually costs. */
export function BudgetBuilderSummaryBar({ total, typicalSpend }: BudgetBuilderSummaryBarProps) {
  const diff = total - typicalSpend
  const pct = typicalSpend > 0 ? (diff / typicalSpend) * 100 : null
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Budgeted" value={formatCurrency(total, "USD", 0)} sub="per month" />
      <Stat label="Typical month" value={typicalSpend > 0 ? formatCurrency(typicalSpend, "USD", 0) : "—"} sub="lifestyle spend (median)" />
      <Stat
        label={diff >= 0 ? "Above typical" : "Below typical"}
        value={typicalSpend > 0 ? formatCurrency(Math.abs(diff), "USD", 0) : "—"}
        sub={pct != null ? `${diff >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}% vs typical` : ""}
        tone={typicalSpend > 0 ? (diff >= 0 ? "neutral" : "warn") : undefined}
      />
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "neutral" | "warn" }) {
  return (
    <div className="rounded-xl bg-background-secondary border border-card-border px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground-muted truncate">{label}</p>
      <p className={cn("text-base font-bold tabular-nums truncate", tone === "warn" ? "text-warning" : "text-foreground")}>{value}</p>
      <p className="text-[10px] text-foreground-muted truncate">{sub}</p>
    </div>
  )
}

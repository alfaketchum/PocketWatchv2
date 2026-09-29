import { getCategoryMeta } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"
import type { DraftLine } from "./budget-builder-types"

interface BudgetBuilderSliderRowProps {
  line: DraftLine
  total: number
  onPctChange: (pct: number) => void
  onToggleLock: () => void
  onRemove: () => void
}

/** One category's share of the total: % slider, dollar amount, average marker, lock. */
export function BudgetBuilderSliderRow({ line, total, onPctChange, onToggleLock, onRemove }: BudgetBuilderSliderRowProps) {
  const meta = getCategoryMeta(line.category)
  const pct = total > 0 ? (line.amount / total) * 100 : 0
  const avgPct = total > 0 && line.avgMonthly > 0 ? Math.min((line.avgMonthly / total) * 100, 100) : null
  const vsAvg = line.avgMonthly > 0 ? ((line.amount - line.avgMonthly) / line.avgMonthly) * 100 : null

  return (
    <div className="py-3 border-b border-card-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.hex}20` }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: meta.hex }} aria-hidden="true">{meta.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{line.category}</p>
          <p className="text-[10px] text-foreground-muted tabular-nums">
            avg {formatCurrency(line.avgMonthly, "USD", 0)}/mo
            {vsAvg != null && Math.abs(vsAvg) >= 1 && (
              <span className={cn("ml-1", vsAvg < 0 ? "text-warning" : "text-foreground-muted")}>
                · {vsAvg > 0 ? "+" : ""}{vsAvg.toFixed(0)}% vs avg
              </span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(line.amount, "USD", 0)}</p>
          <p className="text-[10px] tabular-nums text-foreground-muted">{pct.toFixed(1)}%</p>
        </div>
        <button
          onClick={onToggleLock}
          className={cn("touch-target rounded-md transition-colors", line.locked ? "text-primary" : "text-foreground-muted hover:text-foreground")}
          aria-label={line.locked ? `Unlock ${line.category}` : `Lock ${line.category}`}
          aria-pressed={line.locked}
          title={line.locked ? "Locked — other sliders won't change this amount" : "Lock this amount"}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">{line.locked ? "lock" : "lock_open"}</span>
        </button>
        <button onClick={onRemove} className="touch-target rounded-md text-foreground-muted hover:text-error transition-colors" aria-label={`Remove ${line.category}`}>
          <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">close</span>
        </button>
      </div>

      <div className="relative mt-2 ml-11 mr-1">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={pct}
          disabled={line.locked}
          onChange={(e) => onPctChange(Number(e.target.value) / 100)}
          aria-label={`${line.category} share of total`}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: `linear-gradient(to right, ${meta.hex} ${pct}%, var(--card-border) 0%)` }}
        />
        {avgPct != null && (
          <span
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-foreground/40 rounded-full pointer-events-none"
            style={{ left: `${avgPct}%` }}
            title={`Your average: ${formatCurrency(line.avgMonthly, "USD", 0)}`}
          />
        )}
      </div>

      {line.reason && (
        <p className="mt-1.5 ml-11 text-[11px] text-foreground-muted flex items-start gap-1">
          <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 12 }} aria-hidden="true">auto_awesome</span>
          {line.reason}
        </p>
      )}
    </div>
  )
}

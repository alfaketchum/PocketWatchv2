import { getCategoryMeta } from "@/lib/finance/categories"
import { formatCurrency, cn } from "@/lib/utils"
import { BudgetBuilderSummaryBar } from "./budget-builder-summary-bar"
import { draftTotal } from "./budget-builder-helpers"
import type { DraftDiff, DraftLine, ExistingBudget } from "./budget-builder-types"

interface BudgetBuilderAIProposalProps {
  summary: string | null
  lines: DraftLine[]
  existing: ExistingBudget[]
  diff: DraftDiff
  typicalSpend: number
}

/** Read-only view of the AI's proposed budget: current → proposed per category, with reasons. */
export function BudgetBuilderAIProposal({ summary, lines, existing, diff, typicalSpend }: BudgetBuilderAIProposalProps) {
  const current = new Map(existing.map((b) => [b.category, b.monthlyLimit]))
  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-foreground leading-relaxed flex gap-2">
          <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true">auto_awesome</span>
          <p>{summary}</p>
        </div>
      )}

      <BudgetBuilderSummaryBar total={draftTotal(lines)} typicalSpend={typicalSpend} />

      <p className="text-xs text-foreground-muted">
        {diff.added.length} new · {diff.changed.length} changed · {lines.length - diff.added.length - diff.changed.length} unchanged
      </p>

      <div className="rounded-2xl border border-card-border bg-card divide-y divide-card-border/50">
        {lines.map((l) => {
          const meta = getCategoryMeta(l.category)
          const was = current.get(l.category)
          const delta = was != null ? Math.round(l.amount) - Math.round(was) : null
          return (
            <div key={l.category} className="px-4 py-3 flex items-start gap-3">
              <span className="material-symbols-rounded flex-shrink-0 mt-0.5" style={{ fontSize: 18, color: meta.hex }} aria-hidden="true">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{l.category}</p>
                {l.reason && <p className="text-[11px] text-foreground-muted mt-0.5 leading-relaxed">{l.reason}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(l.amount, "USD", 0)}</p>
                <p className={cn("text-[10px] tabular-nums", delta == null ? "text-success" : delta === 0 ? "text-foreground-muted" : "text-primary")}>
                  {delta == null ? "new" : delta === 0 ? "no change" : `was ${formatCurrency(was ?? 0, "USD", 0)}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

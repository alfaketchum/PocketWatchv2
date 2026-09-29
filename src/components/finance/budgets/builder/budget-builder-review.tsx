import { getCategoryMeta } from "@/lib/finance/categories"
import { formatCurrency } from "@/lib/utils"
import { BudgetBuilderSummaryBar } from "./budget-builder-summary-bar"
import type { DraftDiff } from "./budget-builder-types"

interface BudgetBuilderReviewProps {
  diff: DraftDiff
  total: number
  typicalSpend: number
}

/** What saving will add, change and remove. */
export function BudgetBuilderReview({ diff, total, typicalSpend }: BudgetBuilderReviewProps) {
  const noChanges = diff.added.length + diff.changed.length + diff.removed.length === 0
  return (
    <div className="space-y-4">
      <BudgetBuilderSummaryBar total={total} typicalSpend={typicalSpend} />
      {noChanges ? (
        <p className="text-sm text-foreground-muted py-8 text-center">No changes from your current budgets.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Group title="Adding" icon="add_circle" tone="text-success" empty="Nothing new">
            {diff.added.map((a) => <Row key={a.category} category={a.category} value={formatCurrency(a.amount, "USD", 0)} />)}
          </Group>
          <Group title="Changing" icon="swap_vert" tone="text-primary" empty="No amount changes">
            {diff.changed.map((c) => (
              <Row key={c.category} category={c.category} value={`${formatCurrency(c.from, "USD", 0)} → ${formatCurrency(c.to, "USD", 0)}`} />
            ))}
          </Group>
          <Group title="Removing" icon="remove_circle" tone="text-error" empty="Nothing removed">
            {diff.removed.map((r) => <Row key={r.category} category={r.category} value={formatCurrency(r.amount, "USD", 0)} strike />)}
          </Group>
        </div>
      )}
    </div>
  )
}

function Group({ title, icon, tone, empty, children }: { title: string; icon: string; tone: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4">
      <p className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${tone}`}>
        <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">{icon}</span>
        {title} · {children.length}
      </p>
      {children.length === 0 ? <p className="text-xs text-foreground-muted">{empty}</p> : <div className="space-y-1.5">{children}</div>}
    </div>
  )
}

function Row({ category, value, strike }: { category: string; value: string; strike?: boolean }) {
  const meta = getCategoryMeta(category)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14, color: meta.hex }} aria-hidden="true">{meta.icon}</span>
      <span className="truncate text-foreground">{category}</span>
      <span className={`ml-auto tabular-nums text-foreground-muted whitespace-nowrap ${strike ? "line-through" : ""}`}>{value}</span>
    </div>
  )
}

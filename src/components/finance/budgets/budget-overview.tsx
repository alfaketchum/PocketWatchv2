"use client"

import { useMemo, useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { useUpdateTransactionCategory, useBulkCategorize, useUpdateTransaction } from "@/hooks/use-finance"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { BudgetSpendingDonut, type DonutSlice } from "./budget-spending-donut"
import { BudgetDailyBars } from "./budget-daily-bars"
import { BudgetTransactionsTable, type BudgetTxRow } from "./budget-transactions-table"

interface OverviewTx {
  id: string
  date: string
  name: string
  merchantName: string | null
  amount: number
  category: string | null
  isExcluded: boolean
  notes: string | null
  account: { name: string; mask: string | null }
}

// Same spending definition the budget totals use (outflows, minus transfers/income/investments).
const EXCLUDE = new Set(["Transfer", "Income", "Investment"])

interface BudgetOverviewProps {
  transactions: OverviewTx[]
  totalBudgeted: number
  periodLabel: string
}

/**
 * Personal Capital-style spending overview: a category donut that decomposes to
 * a category's transactions on click, a category spending list, a daily bar
 * chart, and a filterable transactions table.
 */
export function BudgetOverview({ transactions, totalBudgeted, periodLabel }: BudgetOverviewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const updateCat = useUpdateTransactionCategory()
  const bulkCat = useBulkCategorize()
  const updateTx = useUpdateTransaction()
  const [pending, setPending] = useState<{ category: string; merchant: string; ids: string[] } | null>(null)

  // Re-categorize one transaction; if the same merchant recurs, offer to update them all.
  const handleRecategorize = (tx: BudgetTxRow, category: string) => {
    updateCat.mutate({ transactionId: tx.id, category })
    const key = (tx.merchantName ?? tx.name).trim().toLowerCase()
    const siblings = transactions.filter(
      (t) => t.id !== tx.id && (t.merchantName ?? t.name).trim().toLowerCase() === key && (t.category ?? "Uncategorized") !== category,
    )
    if (siblings.length > 0) setPending({ category, merchant: tx.merchantName ?? tx.name, ids: siblings.map((s) => s.id) })
  }

  const handleSaveNote = (txId: string, note: string) => updateTx.mutate({ transactionId: txId, notes: note })

  const { slices, catList, daily, totalSpend } = useMemo(() => {
    const spend = transactions.filter((t) => t.amount > 0 && !t.isExcluded && !EXCLUDE.has(t.category ?? ""))
    const catMap = new Map<string, number>()
    const dayMap = new Map<string, number>()
    for (const t of spend) {
      const c = t.category ?? "Uncategorized"
      catMap.set(c, (catMap.get(c) ?? 0) + t.amount)
      const d = t.date.slice(0, 10)
      dayMap.set(d, (dayMap.get(d) ?? 0) + t.amount)
    }
    const catList = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount, color: getCategoryMeta(category).hex }))
      .sort((a, b) => b.amount - a.amount)
    const totalSpend = catList.reduce((s, c) => s + c.amount, 0)
    const daily = [...dayMap.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))
    return { slices: catList as DonutSlice[], catList, daily, totalSpend }
  }, [transactions])

  const tableRows: BudgetTxRow[] = useMemo(
    () =>
      transactions
        .filter((t) => selected == null || (t.category ?? "Uncategorized") === selected)
        .map((t) => ({ id: t.id, date: t.date, name: t.name, merchantName: t.merchantName, category: t.category, amount: t.amount, notes: t.notes, account: t.account })),
    [transactions, selected],
  )

  return (
    <div className="space-y-4">
      <div className="bg-card border border-card-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">All spending</h2>
          <span className="text-xs text-foreground-muted">{periodLabel}</span>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <BudgetSpendingDonut slices={slices} total={totalSpend} budget={totalBudgeted} selected={selected} onSelect={setSelected} />

          {/* Category list */}
          <div className="flex-1 min-w-0 lg:max-w-[280px] max-h-[220px] overflow-y-auto scroll-touch">
            {catList.length === 0 ? (
              <p className="text-sm text-foreground-muted py-6 text-center">No spending in this period.</p>
            ) : catList.map((c) => (
              <button
                key={c.category}
                onClick={() => setSelected(selected === c.category ? null : c.category)}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors", selected === c.category ? "bg-primary-muted" : "hover:bg-background-secondary")}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="text-sm text-foreground truncate">{c.category}</span>
                <span className="ml-auto text-sm tabular-nums text-foreground-muted">{formatCurrency(c.amount)}</span>
              </button>
            ))}
          </div>

          {/* Daily bars */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-foreground-muted mb-2">Daily spending</p>
            <BudgetDailyBars data={daily} />
          </div>
        </div>
      </div>

      <BudgetTransactionsTable
        transactions={tableRows}
        activeCategory={selected}
        onClearCategory={() => setSelected(null)}
        onRecategorize={handleRecategorize}
        onSaveNote={handleSaveNote}
      />

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => { if (pending) bulkCat.mutate({ ids: pending.ids, category: pending.category }); setPending(null) }}
        title="Re-categorize recurring transactions?"
        description={`"${pending?.merchant ?? ""}" appears on ${pending?.ids.length ?? 0} other transaction${pending?.ids.length === 1 ? "" : "s"} in this period. Move ${pending?.ids.length === 1 ? "it" : "them all"} to "${pending?.category ?? ""}" too?`}
        confirmLabel={`Update ${pending?.ids.length ?? 0}`}
        isLoading={bulkCat.isPending}
      />
    </div>
  )
}

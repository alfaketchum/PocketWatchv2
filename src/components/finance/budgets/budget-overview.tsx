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
  subcategory: string | null
  isExcluded: boolean
  isPending: boolean
  isRecurring: boolean
  needsReview: boolean
  notes: string | null
  logoUrl: string | null
  website: string | null
  paymentChannel: string | null
  authorizedDate: string | null
  location: { city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null } | null
  counterparties: Array<{ name: string; type: string; logoUrl?: string | null }> | null
  account: { name: string; mask: string | null }
}

// Same spending definition the budget totals use (outflows, minus transfers/income/investments).
const EXCLUDE = new Set(["Transfer", "Income", "Investment"])

/**
 * Build a continuous daily series (one entry per calendar day between the first
 * and last date), filling no-spend days with 0 so the bar chart reads as a real
 * timeline instead of collapsing gaps. Capped so a long lookback can't run away.
 */
function buildDailySeries(start: string | undefined, end: string | undefined, dayMap: Map<string, number>) {
  const out: Array<{ date: string; amount: number }> = []
  if (!start || !end) return out
  const cur = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  for (let guard = 0; cur <= last && guard < 400; guard++) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
    out.push({ date: iso, amount: dayMap.get(iso) ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const updateCat = useUpdateTransactionCategory()
  const bulkCat = useBulkCategorize()
  const updateTx = useUpdateTransaction()
  const [pending, setPending] = useState<{ category: string; subcategory: string | null; merchant: string; ids: string[] } | null>(null)

  // Re-categorize one transaction; if the same merchant recurs, offer to update them all.
  const handleRecategorize = (tx: BudgetTxRow, category: string, subcategory?: string | null) => {
    updateCat.mutate({ transactionId: tx.id, category, subcategory: subcategory ?? undefined })
    const key = (tx.merchantName ?? tx.name).trim().toLowerCase()
    const siblings = transactions.filter(
      (t) => t.id !== tx.id && (t.merchantName ?? t.name).trim().toLowerCase() === key && (t.category ?? "Uncategorized") !== category,
    )
    if (siblings.length > 0) setPending({ category, subcategory: subcategory ?? null, merchant: tx.merchantName ?? tx.name, ids: siblings.map((s) => s.id) })
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
    const dates = transactions.map((t) => t.date.slice(0, 10)).sort()
    const daily = buildDailySeries(dates[0], dates[dates.length - 1], dayMap)
    return { slices: catList as DonutSlice[], catList, daily, totalSpend }
  }, [transactions])

  const tableRows: BudgetTxRow[] = useMemo(
    () =>
      transactions
        .filter((t) => selected == null || (t.category ?? "Uncategorized") === selected)
        .filter((t) => selectedDay == null || t.date.slice(0, 10) === selectedDay)
        .map((t) => ({
          id: t.id, date: t.date, name: t.name, merchantName: t.merchantName,
          category: t.category, subcategory: t.subcategory, amount: t.amount, notes: t.notes,
          isPending: t.isPending, isRecurring: t.isRecurring, needsReview: t.needsReview,
          logoUrl: t.logoUrl, website: t.website, paymentChannel: t.paymentChannel,
          authorizedDate: t.authorizedDate, location: t.location, counterparties: t.counterparties,
          account: t.account,
        })),
    [transactions, selected, selectedDay],
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
            <BudgetDailyBars data={daily} selected={selectedDay} onSelect={setSelectedDay} />
          </div>
        </div>
      </div>

      <BudgetTransactionsTable
        transactions={tableRows}
        activeCategory={selected}
        onClearCategory={() => setSelected(null)}
        activeDay={selectedDay}
        onClearDay={() => setSelectedDay(null)}
        onRecategorize={handleRecategorize}
        onSaveNote={handleSaveNote}
      />

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => { if (pending) bulkCat.mutate({ ids: pending.ids, category: pending.category, subcategory: pending.subcategory ?? undefined }); setPending(null) }}
        title="Re-categorize recurring transactions?"
        description={`"${pending?.merchant ?? ""}" appears on ${pending?.ids.length ?? 0} other transaction${pending?.ids.length === 1 ? "" : "s"} in this period. Move ${pending?.ids.length === 1 ? "it" : "them all"} to "${pending?.category ?? ""}" too?`}
        confirmLabel={`Update ${pending?.ids.length ?? 0}`}
        cancelLabel="No, just this one"
        isLoading={bulkCat.isPending}
      />
    </div>
  )
}

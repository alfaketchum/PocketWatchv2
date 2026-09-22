"use client"

import { TransactionTableRow } from "./transaction-table-row"

interface TableTx {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  subcategory: string | null
  tags: string[]
  notes?: string | null
  isPending: boolean
  account: { name: string; mask: string | null }
  logoUrl?: string | null
  website?: string | null
  needsReview?: boolean
  isRecurring?: boolean
}

interface TransactionsTableViewProps {
  transactions: TableTx[]
  highlightId: string
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  onRecategorize: (tx: TableTx, category: string, subcategory?: string | null) => void
  onSaveNote: (txId: string, note: string) => void
}

/**
 * Budget-style transactions table — the alternate "table" view for the
 * transactions page. Columns mirror the budget panel's transactions table,
 * with a leading select checkbox wired to the same bulk-action state.
 */
export function TransactionsTableView({
  transactions, highlightId, selectedIds, setSelectedIds, onRecategorize, onSaveNote,
}: TransactionsTableViewProps) {
  const allSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id))

  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds)
    transactions.forEach((t) => { if (checked) next.add(t.id); else next.delete(t.id) })
    setSelectedIds(next)
  }
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  return (
    // No overflow wrapper so the category/note popovers aren't clipped.
    <div className="bg-card border border-card-border rounded-xl" style={{ boxShadow: "var(--shadow-sm)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-card-border bg-card-elevated text-[10px] uppercase tracking-widest text-foreground-muted">
            <th className="pl-4 pr-1 py-2.5 w-9">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary align-middle"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                title="Select all on this page"
              />
            </th>
            <th className="text-left font-semibold px-3 py-2.5">Date</th>
            <th className="text-left font-semibold px-3 py-2.5">Account</th>
            <th className="text-left font-semibold px-3 py-2.5">Description</th>
            <th className="text-left font-semibold px-3 py-2.5">Category</th>
            <th className="text-center font-semibold px-3 py-2.5">Note</th>
            <th className="text-right font-semibold px-4 py-2.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <TransactionTableRow
              key={tx.id}
              id={tx.id}
              date={tx.date}
              merchantName={tx.merchantName}
              name={tx.name}
              amount={tx.amount}
              category={tx.category}
              subcategory={tx.subcategory}
              tags={tx.tags}
              notes={tx.notes}
              isPending={tx.isPending}
              accountName={tx.account.name}
              accountMask={tx.account.mask}
              logoUrl={tx.logoUrl}
              website={tx.website}
              needsReview={tx.needsReview}
              isRecurring={tx.isRecurring}
              isHighlighted={tx.id === highlightId}
              selected={selectedIds.has(tx.id)}
              onToggleSelect={() => toggleOne(tx.id)}
              onRecategorize={(cat, sub) => onRecategorize(tx, cat, sub)}
              onSaveNote={(note) => onSaveNote(tx.id, note)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

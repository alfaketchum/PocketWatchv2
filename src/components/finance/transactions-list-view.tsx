"use client"

import { cn } from "@/lib/utils"
import { TransactionRow } from "@/components/finance/transaction-row"
import { type SortDir } from "@/components/finance/sortable-th"

interface ListTx {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  subcategory: string | null
  notes?: string | null
  tags: string[]
  isPending: boolean
  account: { name: string; mask: string | null }
  paymentChannel?: string | null
  authorizedDate?: string | null
  logoUrl?: string | null
  website?: string | null
  location?: { city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null } | null
  counterparties?: Array<{ name: string; type: string; logoUrl?: string | null }> | null
  needsReview?: boolean
  isRecurring?: boolean
}

interface Props {
  transactions: ListTx[]
  highlightId: string
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  onRecategorize: (tx: ListTx, category: string, subcategory?: string | null) => void
  onSaveNote: (txId: string, note: string) => void
  onSaveTags: (txId: string, tags: string[]) => void
  onMarkSubscription: (txId: string, unmark: boolean) => void
  sortField: string
  sortDir: SortDir
  onSort: (field: string) => void
}

function SortLabel({ field, label, sortField, sortDir }: { field: string; label: string; sortField: string; sortDir: SortDir }) {
  const active = sortField === field
  return (
    <>
      {label}
      <span className={cn("material-symbols-rounded", active ? "opacity-90" : "opacity-40")} style={{ fontSize: 13 }}>
        {active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
      </span>
    </>
  )
}

/**
 * The rich, expandable-rows "list" view for the transactions page — the default
 * alternate to the compact TransactionsTableView.
 */
export function TransactionsListView({
  transactions, highlightId, selectedIds, setSelectedIds,
  onRecategorize, onSaveNote, onSaveTags, onMarkSubscription,
  sortField, sortDir, onSort,
}: Props) {
  const allSelected = transactions.length > 0 && transactions.every((tx) => selectedIds.has(tx.id))
  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds)
    transactions.forEach((tx) => { if (checked) next.add(tx.id); else next.delete(tx.id) })
    setSelectedIds(next)
  }
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id); else next.delete(id)
    setSelectedIds(next)
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Elevated Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-card-border bg-card-elevated text-[10px] text-foreground-muted font-semibold uppercase tracking-widest">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-primary flex-shrink-0"
          checked={allSelected}
          onChange={(e) => toggleAll(e.target.checked)}
          title="Select all on this page"
        />
        <button type="button" onClick={() => onSort("date")} className={cn("w-10 sm:w-16 inline-flex items-center gap-0.5 text-left hover:text-foreground transition-colors", sortField === "date" && "text-foreground")}>
          <SortLabel field="date" label="Date" sortField={sortField} sortDir={sortDir} />
        </button>
        <div className="flex-1">Description</div>
        <div className="w-28 hidden md:block">Category</div>
        <button type="button" onClick={() => onSort("amount")} className={cn("w-24 inline-flex items-center justify-end gap-0.5 hover:text-foreground transition-colors", sortField === "amount" && "text-foreground")}>
          <span className={cn("material-symbols-rounded", sortField === "amount" ? "opacity-90" : "opacity-40")} style={{ fontSize: 13 }}>
            {sortField === "amount" ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
          </span>
          Amount
        </button>
        <div className="w-5" />
      </div>

      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-primary flex-shrink-0 ml-3 sm:ml-4"
            checked={selectedIds.has(tx.id)}
            onChange={(e) => toggleOne(tx.id, e.target.checked)}
          />
          <div className="flex-1 min-w-0">
            <TransactionRow
              id={tx.id}
              isHighlighted={tx.id === highlightId}
              date={tx.date}
              merchantName={tx.merchantName}
              name={tx.name}
              amount={tx.amount}
              category={tx.category}
              subcategory={tx.subcategory}
              notes={tx.notes}
              tags={tx.tags}
              isPending={tx.isPending}
              accountName={tx.account.name}
              accountMask={tx.account.mask}
              paymentChannel={tx.paymentChannel}
              authorizedDate={tx.authorizedDate}
              logoUrl={tx.logoUrl}
              website={tx.website}
              location={tx.location}
              counterparties={tx.counterparties}
              needsReview={tx.needsReview}
              isRecurring={tx.isRecurring}
              onRecategorize={(cat, sub) => onRecategorize(tx, cat, sub)}
              onSaveNote={(note) => onSaveNote(tx.id, note)}
              onSaveTags={(tags) => onSaveTags(tx.id, tags)}
              onMarkSubscription={(unmark) => onMarkSubscription(tx.id, unmark)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

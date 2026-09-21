"use client"

import { useState, useMemo, useEffect } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { CategoryPicker } from "@/components/finance/category-picker"
import { NoteCell } from "@/components/finance/note-cell"

export interface BudgetTxRow {
  id: string
  date: string
  name: string
  merchantName: string | null
  category: string | null
  amount: number
  notes: string | null
  account: { name: string; mask: string | null }
}

const PAGE_SIZE = 25

interface BudgetTransactionsTableProps {
  transactions: BudgetTxRow[]
  /** Non-null when the donut/category list has drilled into one category. */
  activeCategory: string | null
  onClearCategory: () => void
  /** Re-categorize a transaction to a new category (opens the smart dialog upstream). */
  onRecategorize?: (tx: BudgetTxRow, category: string) => void
  /** Save a per-transaction note. */
  onSaveNote?: (txId: string, note: string) => void
}

export function BudgetTransactionsTable({ transactions, activeCategory, onClearCategory, onRecategorize, onSaveNote }: BudgetTransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = transactions.filter((t) => {
      if (!q) return true
      return (t.merchantName ?? t.name).toLowerCase().includes(q) || (t.category ?? "").toLowerCase().includes(q)
    })
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(0) }, [search, activeCategory])
  const rows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="bg-card border border-card-border rounded-xl" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-card-border flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="bg-transparent border-none outline-none text-sm text-foreground placeholder-foreground-muted w-44"
          />
          {activeCategory && (
            <button onClick={onClearCategory} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary-muted rounded-full px-2 py-0.5">
              {activeCategory}
              <span className="material-symbols-rounded" style={{ fontSize: 13 }}>close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground-muted tabular-nums">
          <span>{filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}`} of {filtered.length}</span>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-1 rounded-md hover:bg-background-secondary disabled:opacity-30 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="p-1 rounded-md hover:bg-background-secondary disabled:opacity-30 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Table (no overflow wrapper so the category picker popover isn't clipped) */}
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="text-left font-semibold px-4 py-2">Date</th>
              <th className="text-left font-semibold px-4 py-2">Account</th>
              <th className="text-left font-semibold px-4 py-2">Description</th>
              <th className="text-left font-semibold px-4 py-2">Category</th>
              <th className="text-center font-semibold px-4 py-2">Note</th>
              <th className="text-right font-semibold px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground-muted">No transactions.</td></tr>
            ) : rows.map((t) => {
              const meta = getCategoryMeta(t.category)
              const out = t.amount > 0
              return (
                <tr key={t.id} className="border-t border-card-border/50 hover:bg-background-secondary/40 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-foreground-muted tabular-nums">{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center max-w-[170px] truncate text-[11px] rounded-full px-2 py-0.5 bg-background-secondary border border-card-border text-foreground-muted">
                      {t.account.name}{t.account.mask ? ` ••${t.account.mask}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground max-w-[220px] truncate">{t.merchantName ?? t.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5"
                        style={{ background: `color-mix(in srgb, ${meta.hex} 13%, transparent)`, color: meta.hex }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.hex }} />
                        {t.category ?? "Uncategorized"}
                      </span>
                      {onRecategorize && <CategoryPicker value={t.category} onSelect={(cat) => onRecategorize(t, cat)} />}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {onSaveNote ? (
                      <NoteCell note={t.notes} onSave={(v) => onSaveNote(t.id, v)} />
                    ) : t.notes ? (
                      <span className="material-symbols-rounded text-primary" style={{ fontSize: 15 }} title={t.notes}>sticky_note_2</span>
                    ) : null}
                  </td>
                  <td className={cn("px-4 py-2.5 text-right whitespace-nowrap tabular-nums font-semibold", out ? "text-foreground" : "text-success")}>
                    {out ? "-" : "+"}{formatCurrency(Math.abs(t.amount))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

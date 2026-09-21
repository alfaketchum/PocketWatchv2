"use client"

import { useState, useMemo, useEffect } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { CategoryPicker } from "@/components/finance/category-picker"
import { NoteCell } from "@/components/finance/note-cell"
import { TransactionRow } from "@/components/finance/transaction-row"

export interface BudgetTxRow {
  id: string
  date: string
  name: string
  merchantName: string | null
  category: string | null
  subcategory: string | null
  amount: number
  notes: string | null
  isPending: boolean
  isRecurring: boolean
  needsReview: boolean
  logoUrl: string | null
  website: string | null
  paymentChannel: string | null
  authorizedDate: string | null
  location: { city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null } | null
  counterparties: Array<{ name: string; type: string; logoUrl?: string | null }> | null
  account: { name: string; mask: string | null }
}

const PAGE_SIZE = 25
// Shared with the main Transactions page so the List/Table preference stays
// consistent across both.
const VIEW_KEY = "tx-view"

interface BudgetTransactionsTableProps {
  transactions: BudgetTxRow[]
  /** Non-null when the donut/category list has drilled into one category. */
  activeCategory: string | null
  onClearCategory: () => void
  /** Non-null (YYYY-MM-DD) when the daily bar chart has drilled into one day. */
  activeDay?: string | null
  onClearDay?: () => void
  /** Re-categorize a transaction to a new category (opens the smart dialog upstream). */
  onRecategorize?: (tx: BudgetTxRow, category: string) => void
  /** Save a per-transaction note. */
  onSaveNote?: (txId: string, note: string) => void
}

export function BudgetTransactionsTable({ transactions, activeCategory, onClearCategory, activeDay, onClearDay, onRecategorize, onSaveNote }: BudgetTransactionsTableProps) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  // List (rich rows) vs. table (compact) — defaults to list, persisted per-browser.
  const [view, setView] = useState<"list" | "table">("list")
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === "list" || v === "table") setView(v) } catch { /* ignore */ }
  }, [])
  const changeView = (v: "list" | "table") => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = transactions.filter((t) => {
      if (!q) return true
      return (t.merchantName ?? t.name).toLowerCase().includes(q) || (t.category ?? "").toLowerCase().includes(q)
    })
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage(0) }, [search, activeCategory, activeDay])
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
          {activeDay && (
            <button onClick={onClearDay} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary-muted rounded-full px-2 py-0.5">
              {new Date(`${activeDay}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <span className="material-symbols-rounded" style={{ fontSize: 13 }}>close</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground-muted tabular-nums">
          {/* List / Table view toggle */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg mr-1">
            {([
              { key: "list", label: "List", icon: "view_agenda" },
              { key: "table", label: "Table", icon: "table_rows" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => changeView(opt.key)}
                title={`${opt.label} view`}
                aria-pressed={view === opt.key}
                className={cn(
                  "inline-flex items-center justify-center w-7 h-6 rounded-md transition-colors",
                  view === opt.key ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
                )}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">{opt.icon}</span>
              </button>
            ))}
          </div>
          <span>{filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}`} of {filtered.length}</span>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-1 rounded-md hover:bg-background-secondary disabled:opacity-30 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="p-1 rounded-md hover:bg-background-secondary disabled:opacity-30 transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {view === "list" ? (
        /* List view — rich expandable rows, same as the main Transactions page */
        <div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-foreground-muted">No transactions.</p>
          ) : rows.map((t) => (
            <TransactionRow
              key={t.id}
              id={t.id}
              date={t.date}
              merchantName={t.merchantName}
              name={t.name}
              amount={t.amount}
              category={t.category}
              subcategory={t.subcategory}
              notes={t.notes}
              isPending={t.isPending}
              accountName={t.account.name}
              accountMask={t.account.mask}
              logoUrl={t.logoUrl}
              website={t.website}
              location={t.location}
              counterparties={t.counterparties}
              paymentChannel={t.paymentChannel}
              authorizedDate={t.authorizedDate}
              needsReview={t.needsReview}
              isRecurring={t.isRecurring}
              onRecategorize={onRecategorize ? (cat) => onRecategorize(t, cat) : undefined}
              onSaveNote={onSaveNote ? (note) => onSaveNote(t.id, note) : undefined}
            />
          ))}
        </div>
      ) : (
      /* Table (no overflow wrapper so the category picker popover isn't clipped) */
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
      )}
    </div>
  )
}

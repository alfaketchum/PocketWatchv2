"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  useFinanceTransactions, useFinanceAccounts,
  useAutoCategorize, useFinanceDeepInsights,
  useUpdateTransactionCategory, useReviewCount,
  useBulkCategorize, useUpdateTransaction,
} from "@/hooks/use-finance"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceTableSkeleton } from "@/components/finance/finance-loading"
import { TransactionRow } from "@/components/finance/transaction-row"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { BulkActionBar } from "@/components/finance/bulk-action-bar"
import { DATE_PRESETS, getDateRange } from "@/components/finance/transactions-helpers"
import { useHighlightScroll } from "@/hooks/finance/use-highlight-scroll"
import { TransactionCategoryFilter } from "@/components/finance/transaction-category-filter"
import { TransactionAccountFilter } from "@/components/finance/transaction-account-filter"
import { TransactionTagFilter } from "@/components/finance/transaction-tag-filter"
import { TransactionsTableView } from "@/components/finance/transactions-table-view"
import { DatePicker } from "@/components/ui/date-picker"

export default function FinanceTransactionsPage() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") ?? ""
  const highlightId = searchParams.get("highlight") ?? ""
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [categorySet, setCategorySet] = useState<Set<string>>(() => { const c = searchParams.get("category"); return new Set(c ? [c] : []) })
  const [accountSet, setAccountSet] = useState<Set<string>>(() => { const a = searchParams.get("account"); return new Set(a ? [a] : []) })
  const [tag, setTag] = useState(searchParams.get("tag") ?? "")
  const toggleCategory = (c: string) => { setCategorySet((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n }); setPage(1) }
  const toggleAccount = (id: string) => { setAccountSet((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }); setPage(1) }
  // Optional ?month=YYYY-MM scopes to that calendar month (drill-through from the
  // dashboard spending donut, so the filtered totals match the month clicked).
  const monthParam = /^\d{4}-\d{2}$/.test(searchParams.get("month") ?? "") ? searchParams.get("month")! : ""
  const monthEnd = monthParam
    ? new Date(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)), 0).toISOString().slice(0, 10)
    : ""
  // A ?highlight target may be any age, so default to the all-time range so the
  // linked transaction is actually in the result set (and can be scrolled to).
  const [dateRange, setDateRange] = useState(monthParam ? "custom" : (highlightId || searchParams.get("category") || initialSearch ? "all" : "this-month"))
  const [txType, setTxType] = useState("")
  const [customStart, setCustomStart] = useState(monthParam ? `${monthParam}-01` : "")
  const [customEnd, setCustomEnd] = useState(monthEnd)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Layout toggle: "list" is the rich expandable rows, "table" is the compact
  // budget-style table (persisted per-browser).
  const [view, setView] = useState<"list" | "table">("list")
  useEffect(() => {
    try { const v = localStorage.getItem("tx-view"); if (v === "list" || v === "table") setView(v) } catch { /* ignore */ }
  }, [])
  const changeView = (v: "list" | "table") => { setView(v); try { localStorage.setItem("tx-view", v) } catch { /* ignore */ } }

  // Clear selections when page/filters change — track previous data identity
  const prevDataRef = useRef<string>("")
  useEffect(() => {
    const key = `${page}-${dateRange}-${[...categorySet].sort().join("|")}-${[...accountSet].sort().join("|")}-${tag}-${txType}-${search}`
    if (prevDataRef.current && prevDataRef.current !== key) {
      setSelectedIds(new Set())
    }
    prevDataRef.current = key
  }, [page, dateRange, categorySet, accountSet, tag, txType, search])

  const dates = dateRange === "custom"
    ? { start: customStart || undefined, end: customEnd || undefined }
    : getDateRange(dateRange)
  const { data, isLoading, isError } = useFinanceTransactions({
    page,
    limit: 50,
    search: search || undefined,
    category: categorySet.size ? [...categorySet].join(",") : undefined,
    accountId: accountSet.size ? [...accountSet].join(",") : undefined,
    tag: tag || undefined,
    startDate: dates.start,
    endDate: dates.end,
    txType: txType || undefined,
  })
  const { data: institutions } = useFinanceAccounts()
  const { data: deep } = useFinanceDeepInsights()
  const autoCategorize = useAutoCategorize()
  const updateCategory = useUpdateTransactionCategory()
  const bulkCategorize = useBulkCategorize()
  const updateTx = useUpdateTransaction()
  const [recatPending, setRecatPending] = useState<{ category: string; subcategory: string | null; merchant: string; ids: string[] } | null>(null)

  // Re-categorize one transaction; offer to apply to same-merchant recurring ones.
  const handleRecategorize = (tx: { id: string; merchantName: string | null; name: string }, category: string, subcategory?: string | null) => {
    updateCategory.mutate({ transactionId: tx.id, category, subcategory: subcategory ?? undefined })
    const key = (tx.merchantName ?? tx.name).trim().toLowerCase()
    const siblings = (data?.transactions ?? []).filter(
      (t) => t.id !== tx.id && (t.merchantName ?? t.name).trim().toLowerCase() === key && (t.category ?? "Uncategorized") !== category,
    )
    if (siblings.length > 0) setRecatPending({ category, subcategory: subcategory ?? null, merchant: tx.merchantName ?? tx.name, ids: siblings.map((s) => s.id) })
  }
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const from = total > 0 ? (page - 1) * 50 + 1 : 0
  const to = Math.min(page * 50, total)

  const { data: reviewData } = useReviewCount()

  // Scroll to (and page-walk toward) a ?highlight deep-link target.
  useHighlightScroll(highlightId, data, page, setPage)
  const reviewCount = reviewData?.count ?? 0
  const hasFilters = search || categorySet.size || accountSet.size || tag || txType || dateRange !== "this-month"
  const availableTags = useMemo(() => [...new Set((data?.transactions ?? []).flatMap((t) => t.tags ?? []))], [data])
  const uncategorizedCount = deep?.uncategorizedCount ?? 0
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <FinancePageHeader
          title="Transactions"
          subtitle={isLoading ? undefined : (
            <>
              {total.toLocaleString()} transactions
              {uncategorizedCount > 0 && (
                <> &middot; <span className="text-amber-500 font-semibold">{uncategorizedCount} need categorizing</span></>
              )}
              {reviewCount > 0 && (
                <> &middot; <span className="text-amber-500 font-semibold">{reviewCount} to review</span></>
              )}
            </>
          )}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View toggle — list (detailed rows) vs. table (compact budget-style) */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
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
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors duration-150",
                  view === opt.key ? "bg-primary text-white shadow-sm" : "bg-transparent text-foreground-muted hover:text-foreground",
                )}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{opt.icon}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
          <a
            href="/api/finance/transactions/export"
            download
            title="Export all transactions as CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-background-secondary transition-colors text-foreground-muted"
            style={{ borderColor: "var(--card-border)" }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>download</span>
            Export
          </a>
          {(uncategorizedCount > 0 || reviewCount > 0) && (
            <Link
              href="/finance/categorize"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>checklist</span>
              Review
            </Link>
          )}
          <Link
            href="/finance/categorize?mode=rebuild"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-card-border rounded-lg hover:bg-background-secondary transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>auto_awesome</span>
            AI Categorize
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search — left aligned */}
          <div className="flex items-center gap-2 w-full sm:w-[240px] px-3 py-1.5 min-h-[40px] rounded-lg bg-background-secondary border border-card-border">
            <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search merchants..."
              className="flex-1 min-w-0 bg-transparent border-0 text-sm text-foreground placeholder:text-foreground-muted/50 outline-none"
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1) }} className="text-foreground-muted hover:text-foreground transition-colors flex-shrink-0">
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>

          {/* Timeframe pills */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg overflow-x-auto flex-shrink-0 mobile-pill-group">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => { setDateRange(preset.key); setPage(1) }}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150",
                  dateRange === preset.key ? "bg-primary text-white shadow-sm" : "bg-transparent text-foreground-muted hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Transaction type filter */}
          <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg overflow-x-auto flex-shrink-0 mobile-pill-group">
            {([
              { key: "", label: "All" },
              { key: "charges", label: "Charges" },
              { key: "refunds", label: "Refunds" },
              { key: "pending", label: "Pending" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setTxType(opt.key); setPage(1) }}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150",
                  txType === opt.key ? "bg-primary text-white shadow-sm" : "bg-transparent text-foreground-muted hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Grouped multi-select category + account chips */}
          <TransactionCategoryFilter selected={[...categorySet]} onToggle={toggleCategory} onClear={() => { setCategorySet(new Set()); setPage(1) }} />
          <TransactionAccountFilter institutions={institutions ?? []} selected={[...accountSet]} onToggle={toggleAccount} onClear={() => { setAccountSet(new Set()); setPage(1) }} />
          <TransactionTagFilter value={tag} onChange={(t) => { setTag(t); setPage(1) }} available={availableTags} />

          {/* Custom date range — pop-out calendar */}
          <div className="flex items-center gap-1.5">
            <div className="w-[140px]">
              <DatePicker value={customStart} onChange={(d) => { setCustomStart(d); setDateRange("custom"); setPage(1) }} placeholder="From" className="!min-h-0 !py-1.5 text-xs" />
            </div>
            <span className="text-xs text-foreground-muted">to</span>
            <div className="w-[140px]">
              <DatePicker value={customEnd} min={customStart} onChange={(d) => { setCustomEnd(d); setDateRange("custom"); setPage(1) }} placeholder="To" className="!min-h-0 !py-1.5 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <FinanceTableSkeleton rows={8} />
      ) : isError ? (
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load transactions. Please try again.</p>
        </div>
      ) : data?.transactions.length ? (
        <>
        <BulkActionBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />
        {view === "table" ? (
        <TransactionsTableView
          transactions={data.transactions}
          highlightId={highlightId}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onRecategorize={(tx, cat, sub) => handleRecategorize(tx, cat, sub)}
          onSaveNote={(txId, note) => updateTx.mutate({ transactionId: txId, notes: note })}
        />
        ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {/* Elevated Header */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-card-border bg-card-elevated text-[10px] text-foreground-muted font-semibold uppercase tracking-widest">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-primary flex-shrink-0"
              checked={data.transactions.length > 0 && data.transactions.every((tx) => selectedIds.has(tx.id))}
              onChange={(e) => {
                const next = new Set(selectedIds)
                if (e.target.checked) data.transactions.forEach((tx) => next.add(tx.id))
                else data.transactions.forEach((tx) => next.delete(tx.id))
                setSelectedIds(next)
              }}
              title="Select all on this page"
            />
            <div className="w-10 sm:w-16">Date</div>
            <div className="flex-1">Description</div>
            <div className="w-28 hidden md:block">Category</div>
            <div className="w-24 text-right">Amount</div>
            <div className="w-5" />
          </div>

          {data.transactions.map((tx) => (
            <div key={tx.id} className="flex items-center">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary flex-shrink-0 ml-3 sm:ml-4"
                checked={selectedIds.has(tx.id)}
                onChange={(e) => {
                  const next = new Set(selectedIds)
                  if (e.target.checked) next.add(tx.id)
                  else next.delete(tx.id)
                  setSelectedIds(next)
                }}
              />
              <div className="flex-1 min-w-0">
            <TransactionRow
              key={tx.id}
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
              onRecategorize={(cat, sub) => handleRecategorize(tx, cat, sub)}
              onSaveNote={(note) => updateTx.mutate({ transactionId: tx.id, notes: note })}
              onSaveTags={(tags) => updateTx.mutate({ transactionId: tx.id, tags })}
            />
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      ) : (
        <FinanceEmpty
          icon={hasFilters ? "filter_list_off" : "receipt_long"}
          title={hasFilters ? "No transactions match your filters" : "No transactions yet"}
          description={
            hasFilters
              ? "Try adjusting your date range, category, or search terms."
              : "Connect a bank account and sync to import transactions."
          }
          linkTo={hasFilters ? undefined : { label: "Connect accounts", href: "/finance/accounts" }}
        />
      )}

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
          <p className="text-xs text-foreground-muted tabular-nums">
            Showing {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30" title="First page">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>first_page</span>
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="min-h-[44px] px-3 sm:px-4 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30 inline-flex items-center justify-center">
              <span className="material-symbols-rounded sm:hidden" style={{ fontSize: 16 }}>chevron_left</span>
              <span className="hidden sm:inline">Previous</span>
            </button>
            <span className="px-3 py-2 text-xs font-data tabular-nums text-foreground-muted">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="min-h-[44px] px-3 sm:px-4 text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30 inline-flex items-center justify-center">
              <span className="material-symbols-rounded sm:hidden" style={{ fontSize: 16 }}>chevron_right</span>
              <span className="hidden sm:inline">Next</span>
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-xs font-medium text-foreground-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-30" title="Last page">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>last_page</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!recatPending}
        onClose={() => setRecatPending(null)}
        onConfirm={() => { if (recatPending) bulkCategorize.mutate({ ids: recatPending.ids, category: recatPending.category, subcategory: recatPending.subcategory ?? undefined }); setRecatPending(null) }}
        title="Re-categorize recurring transactions?"
        description={`"${recatPending?.merchant ?? ""}" appears on ${recatPending?.ids.length ?? 0} other transaction${recatPending?.ids.length === 1 ? "" : "s"} on this page. Move ${recatPending?.ids.length === 1 ? "it" : "them all"} to "${recatPending?.category ?? ""}" too?`}
        confirmLabel={`Update ${recatPending?.ids.length ?? 0}`}
        cancelLabel="No, just this one"
        isLoading={bulkCategorize.isPending}
      />
    </div>
  )
}

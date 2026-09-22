"use client"

import { cn, formatCurrency } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { MerchantIcon } from "./merchant-icon"
import { CategoryPicker } from "./category-picker"
import { NoteCell } from "./note-cell"

export interface TransactionTableRowProps {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  subcategory?: string | null
  notes?: string | null
  isPending: boolean
  accountName: string
  accountMask: string | null
  logoUrl?: string | null
  website?: string | null
  needsReview?: boolean
  isRecurring?: boolean
  isHighlighted?: boolean
  selected: boolean
  onToggleSelect: () => void
  onRecategorize?: (category: string) => void
  onSaveNote?: (note: string) => void
}

/**
 * Compact table row for the transactions "table" view — mirrors the budget
 * transactions table columns (Date · Account · Description · Category · Note ·
 * Amount) with a leading select checkbox for bulk actions.
 */
export function TransactionTableRow({
  id, date, merchantName, name, amount, category, subcategory, notes, isPending,
  accountName, accountMask, logoUrl, website, needsReview, isRecurring,
  isHighlighted, selected, onToggleSelect, onRecategorize, onSaveNote,
}: TransactionTableRowProps) {
  const meta = getCategoryMeta(category)
  const out = amount > 0
  // Parse as local time to avoid a UTC off-by-one (Plaid dates are YYYY-MM-DD).
  const parsed = date.includes("T") ? new Date(date) : new Date(date + "T00:00:00")
  const displayDate = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <tr
      id={isHighlighted ? `tx-${id}` : undefined}
      className={cn(
        "border-t border-card-border/50 hover:bg-background-secondary/40 transition-colors",
        isHighlighted && "ring-2 ring-primary/40 bg-primary/5",
        isPending && "opacity-90",
      )}
    >
      <td className="pl-4 pr-1 py-2.5 align-middle">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-primary align-middle"
          checked={selected}
          onChange={onToggleSelect}
          aria-label="Select transaction"
        />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-foreground-muted tabular-nums align-middle">{displayDate}</td>
      <td className="px-3 py-2.5 whitespace-nowrap align-middle">
        <span className="inline-flex items-center max-w-[150px] truncate text-[11px] rounded-full px-2 py-0.5 bg-background-secondary border border-card-border text-foreground-muted">
          {accountName}{accountMask ? ` ••${accountMask}` : ""}
        </span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-2 min-w-0 max-w-[280px]">
          <MerchantIcon logoUrl={logoUrl} website={website} category={category} size="sm" />
          <div className="min-w-0">
            <p className="text-foreground truncate">
              {merchantName ?? name}
              {isPending && <span className="ml-1 text-[11px] text-foreground-muted">(pending)</span>}
            </p>
            {(isRecurring || needsReview) && (
              <div className="flex items-center gap-2 mt-0.5">
                {isRecurring && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-violet-600 dark:text-violet-400">
                    <span className="material-symbols-rounded" style={{ fontSize: 10 }}>autorenew</span>
                    Subscription
                  </span>
                )}
                {needsReview && (
                  <a href="/finance/categorize" className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-600 hover:text-amber-500 transition-colors">
                    <span className="material-symbols-rounded" style={{ fontSize: 10 }}>rate_review</span>
                    Review
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap align-middle">
        <div className="inline-flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5"
            style={{ background: `color-mix(in srgb, ${meta.hex} 13%, transparent)`, color: meta.hex }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.hex }} />
            {category ?? "Uncategorized"}
          </span>
          {subcategory && <span className="text-[11px] text-foreground-muted">· {subcategory}</span>}
          {onRecategorize && <CategoryPicker value={category} onSelect={onRecategorize} />}
        </div>
      </td>
      <td className="px-3 py-2.5 text-center align-middle">
        {onSaveNote ? (
          <NoteCell note={notes ?? null} onSave={onSaveNote} />
        ) : notes ? (
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 15 }} title={notes}>sticky_note_2</span>
        ) : null}
      </td>
      <td className={cn("px-4 py-2.5 text-right whitespace-nowrap tabular-nums font-semibold align-middle", out ? "text-foreground" : "text-success")}>
        {out ? "-" : "+"}{formatCurrency(Math.abs(amount))}
      </td>
    </tr>
  )
}

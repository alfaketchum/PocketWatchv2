"use client"

import { useState, useRef, useEffect, useCallback, type SyntheticEvent } from "react"
import { createPortal } from "react-dom"
import { cn, formatCurrency } from "@/lib/utils"
import { CategoryBadge } from "./category-badge"
import { AmountDisplay } from "./amount-display"
import { MerchantIcon } from "./merchant-icon"
import { CategoryPicker } from "./category-picker"
import { TagCell } from "./tag-cell"
import { FINANCE_CATEGORIES, getCategoryMeta } from "@/lib/finance/categories"

interface TransactionRowProps {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  subcategory?: string | null
  notes?: string | null
  tags?: string[]
  isPending: boolean
  accountName: string
  accountMask: string | null
  className?: string
  paymentChannel?: string | null
  authorizedDate?: string | null
  logoUrl?: string | null
  website?: string | null
  location?: { city?: string | null; region?: string | null; postalCode?: string | null; country?: string | null } | null
  counterparties?: Array<{ name: string; type: string; logoUrl?: string | null }> | null
  needsReview?: boolean
  isRecurring?: boolean
  isHighlighted?: boolean
  onCategoryChange?: (category: string, createRule: boolean) => void
  /** Grouped-picker re-categorize (opt-in; takes precedence over onCategoryChange). */
  onRecategorize?: (category: string, subcategory?: string | null) => void
  /** Editable per-transaction note (opt-in). */
  onSaveNote?: (note: string) => void
  /** Editable tags (opt-in). */
  onSaveTags?: (tags: string[]) => void
  /** Toggle subscription marking (opt-in). Receives whether to unmark. */
  onMarkSubscription?: (unmark: boolean) => void
}

export function TransactionRow({
  id, date, merchantName, name, amount, category, subcategory,
  notes, tags, isPending, accountName, accountMask, className,
  paymentChannel, authorizedDate, logoUrl, website, location, counterparties,
  needsReview, isRecurring, isHighlighted,
  onCategoryChange, onRecategorize, onSaveNote, onSaveTags, onMarkSubscription,
}: TransactionRowProps) {
  const isSubscription = tags?.includes("subscription") ?? false
  const [expanded, setExpanded] = useState(false)
  const [retagOpen, setRetagOpen] = useState(false)
  const [createRule, setCreateRule] = useState(true)
  const categoryBtnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  // Parse as local time to avoid UTC off-by-one (Plaid dates are YYYY-MM-DD)
  const parsedDate = date.includes("T") ? new Date(date) : new Date(date + "T00:00:00")
  const displayDate = parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const fullDate = parsedDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  const handleCategorySelect = (newCategory: string) => {
    if (newCategory !== category) {
      onCategoryChange?.(newCategory, createRule)
    }
    setRetagOpen(false)
  }

  const openCategoryDropdown = useCallback(() => {
    if (categoryBtnRef.current) {
      const rect = categoryBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left })
    }
    setRetagOpen((prev) => !prev)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!retagOpen) return
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        categoryBtnRef.current && !categoryBtnRef.current.contains(e.target as Node)
      ) {
        setRetagOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [retagOpen])

  return (
    <div
      id={isHighlighted ? `tx-${id}` : undefined}
      className={cn(
        "border-b border-card-border/50",
        isHighlighted && "ring-2 ring-primary/40 bg-primary/5 rounded-lg",
        className,
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover:bg-primary-subtle/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
          isPending && "opacity-90",
        )}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded) } }}
        aria-expanded={expanded}
      >
        <div className="w-10 sm:w-16 text-[10px] sm:text-xs text-foreground-muted font-data">{displayDate}</div>
        <MerchantIcon logoUrl={logoUrl} website={website} category={category} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {merchantName || name}
            {isPending && <span className="ml-1.5 text-xs text-foreground-muted">(pending)</span>}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <CategoryBadge category={category} />
            {subcategory && <span className="inline-flex items-center rounded-full bg-background-secondary text-foreground-muted text-[10px] font-medium px-2 py-0.5">{subcategory}</span>}
            {tags?.map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 rounded-full border border-card-border text-foreground-muted text-[10px] font-medium px-1.5 py-0.5">
                <span className="material-symbols-rounded" style={{ fontSize: 10 }} aria-hidden="true">sell</span>{t}
              </span>
            ))}
            {isRecurring && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <span className="material-symbols-rounded" style={{ fontSize: 10 }}>autorenew</span>
                Subscription
              </span>
            )}
            {needsReview && (
              <a
                href="/finance/categorize"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 10 }}>rate_review</span>
                Review
              </a>
            )}
            <span className="hidden sm:inline text-xs text-foreground-muted">{accountName}{accountMask ? ` ••${accountMask}` : ""}</span>
          </div>
        </div>
        <AmountDisplay amount={amount} />
        <span
          className={cn(
            "material-symbols-rounded text-foreground-muted text-sm transition-transform duration-200",
            expanded && "rotate-180"
          )}
        >
          expand_more
        </span>
      </div>

      {/* Expanded detail panel */}
      <div
        className={cn(
          "overflow-hidden transition-colors duration-200 origin-top",
          expanded ? "max-h-96 opacity-100 scale-y-100" : "max-h-0 opacity-0 scale-y-95"
        )}
      >
        <div className="px-4 pb-3 pt-1 ml-16 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-foreground-muted">Full name</span>
              <p className="text-foreground">{name}</p>
            </div>
            <div>
              <span className="text-foreground-muted">Date</span>
              <p className="text-foreground">{fullDate}</p>
            </div>
            <div>
              <span className="text-foreground-muted">Amount</span>
              <p className="text-foreground font-data">{formatCurrency(Math.abs(amount))}</p>
            </div>
            <div>
              <span className="text-foreground-muted">Category</span>
              {onRecategorize ? (
                <div className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                  <CategoryBadge category={category} />
                  <CategoryPicker value={category} onSelect={onRecategorize} />
                </div>
              ) : onCategoryChange ? (
                <div>
                  <button
                    ref={categoryBtnRef}
                    onClick={(e) => { e.stopPropagation(); openCategoryDropdown() }}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-card-border hover:border-primary/50 transition-colors group"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoryMeta(category).hex }}
                    />
                    <span className="text-foreground">{category ?? "Uncategorized"}</span>
                    <span className="material-symbols-rounded text-[10px] text-foreground-muted group-hover:text-primary transition-colors">
                      edit
                    </span>
                  </button>

                  {/* Category selector dropdown — portal to avoid overflow clipping */}
                  {retagOpen && dropdownPos && createPortal(
                    <div
                      ref={dropdownRef}
                      className="fixed z-[9999] w-56 max-h-64 overflow-y-auto bg-card border border-card-border rounded-lg shadow-xl"
                      style={{ top: dropdownPos.top, left: dropdownPos.left }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-1.5">
                        {Object.entries(FINANCE_CATEGORIES).map(([key, meta]) => (
                          <button
                            key={key}
                            onClick={() => handleCategorySelect(key)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors",
                              key === category
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-primary-subtle/30"
                            )}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: meta.hex }}
                            />
                            <span className="material-symbols-rounded text-sm" style={{ color: meta.hex }}>
                              {meta.icon}
                            </span>
                            <span>{meta.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Create rule toggle */}
                      {merchantName && (
                        <div className="border-t border-card-border/50 px-3 py-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createRule}
                              onChange={(e) => setCreateRule(e.target.checked)}
                              className="rounded border-card-border"
                            />
                            <span className="text-[10px] text-foreground-muted">
                              Apply to all &ldquo;{merchantName}&rdquo; transactions
                            </span>
                          </label>
                        </div>
                      )}
                    </div>,
                    document.body,
                  )}
                </div>
              ) : (
                <p className="text-foreground">{category ?? "Uncategorized"}{subcategory ? ` / ${subcategory}` : ""}</p>
              )}
            </div>
          </div>
          {/* Enriched Plaid data */}
          {(paymentChannel || authorizedDate || website) && (
            <div className="grid grid-cols-2 gap-2">
              {paymentChannel && (
                <div>
                  <span className="text-foreground-muted">Payment</span>
                  <p className="text-foreground capitalize">{paymentChannel}</p>
                </div>
              )}
              {authorizedDate && (
                <div>
                  <span className="text-foreground-muted">Authorized</span>
                  <p className="text-foreground">{new Date(authorizedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              )}
              {website && (
                <div>
                  <span className="text-foreground-muted">Website</span>
                  <p className="text-foreground truncate">{website}</p>
                </div>
              )}
            </div>
          )}
          {location && (location.city || location.region) && (
            <div>
              <span className="text-foreground-muted">Location</span>
              <p className="text-foreground">
                {[location.city, location.region, location.postalCode].filter(Boolean).join(", ")}
                {location.country && location.country !== "US" ? ` ${location.country}` : ""}
              </p>
            </div>
          )}
          {counterparties && counterparties.length > 0 && (
            <div>
              <span className="text-foreground-muted">Counterparties</span>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {counterparties.map((cp, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-background-secondary rounded-full text-foreground">
                    {cp.logoUrl && <img src={cp.logoUrl} alt="" className="w-3 h-3 rounded-full" />}
                    {cp.name}
                    <span className="text-foreground-muted capitalize">({cp.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {onMarkSubscription && (
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onMarkSubscription(isSubscription)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  isSubscription ? "border-primary/30 bg-primary-muted text-primary" : "border-card-border text-foreground hover:bg-background-secondary",
                )}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">autorenew</span>
                {isSubscription ? "Unmark subscription" : "Mark as subscription"}
              </button>
            </div>
          )}
          {onSaveTags && (
            <div onClick={(e) => e.stopPropagation()}>
              <span className="text-foreground-muted">Tags</span>
              <div className="mt-1"><TagCell tags={tags ?? []} onSave={onSaveTags} /></div>
            </div>
          )}
          {onSaveNote ? (
            <div onClick={(e) => e.stopPropagation()}>
              <span className="text-foreground-muted">Notes</span>
              <NoteEditor note={notes ?? null} onSave={onSaveNote} />
            </div>
          ) : notes ? (
            <div>
              <span className="text-foreground-muted">Notes</span>
              <p className="text-foreground">{notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave }: { note: string | null; onSave: (note: string) => void }) {
  const [val, setVal] = useState(note ?? "")
  useEffect(() => { setVal(note ?? "") }, [note])
  return (
    <textarea
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val.trim() !== (note ?? "")) onSave(val.trim()) }}
      rows={2}
      placeholder="Add a note..."
      className="mt-1 w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none resize-none"
    />
  )
}


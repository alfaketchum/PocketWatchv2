"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { CATEGORY_GROUPS, getCategoryMeta } from "@/lib/finance/categories"
import { CATEGORIES } from "@/lib/finance/category-types"
import { usePopoverAlign } from "@/hooks/finance/use-popover-align"

const PANEL_WIDTH = 256 // w-64

interface CategoryPickerProps {
  value: string | null
  /** subcategory is supplied from the second step (a listed one, a typed one, or null). */
  onSelect: (category: string, subcategory?: string | null) => void
  align?: "left" | "right"
}

const SUBCATEGORIES = CATEGORIES as Record<string, readonly string[]>

/**
 * Two-step inline picker: pick a category (grouped, searchable), then pick or
 * type a subcategory. Categories with no defined subcategories select at once.
 */
export function CategoryPicker({ value, onSelect, align = "left" }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [pickedCat, setPickedCat] = useState<string | null>(null)
  const [customSub, setCustomSub] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  // Flip to right-alignment when a left-opening panel would run off the page.
  const overflowsRight = usePopoverAlign(ref, open, PANEL_WIDTH)
  const alignRight = align === "right" || overflowsRight

  const close = () => { setOpen(false); setQ(""); setPickedCat(null); setCustomSub("") }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    return CATEGORY_GROUPS
      .map((g) => ({ ...g, categories: query ? g.categories.filter((c) => c.toLowerCase().includes(query)) : g.categories }))
      .filter((g) => g.categories.length > 0)
  }, [q])

  const subs = pickedCat ? (SUBCATEGORIES[pickedCat] ?? []) : []

  const chooseCategory = (cat: string) => {
    if ((SUBCATEGORIES[cat] ?? []).length > 0) { setPickedCat(cat); setQ(""); setCustomSub("") }
    else { onSelect(cat, null); close() }
  }
  const chooseSub = (sub: string | null) => { if (pickedCat) onSelect(pickedCat, sub); close() }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors",
          open ? "text-primary bg-primary-muted" : "text-foreground-muted/70 hover:text-foreground hover:bg-background-secondary",
        )}
        title="Re-categorize"
        aria-label="Re-categorize"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">edit</span>
      </button>

      {open && (
        <div className={cn("absolute top-full mt-1 z-50 w-64 bg-card border border-card-border rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-1 duration-150", alignRight ? "right-0" : "left-0")}>
          {!pickedCat ? (
            <>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search categories..."
                className="w-full bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-foreground-muted mb-2 focus:border-primary focus:outline-none"
              />
              <div className="max-h-64 overflow-y-auto scroll-touch">
                {groups.length === 0 ? (
                  <p className="text-xs text-foreground-muted text-center py-3">No matches</p>
                ) : groups.map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="flex items-center gap-1.5 px-1.5 py-1">
                      <span className="material-symbols-rounded text-foreground-muted/70" style={{ fontSize: 13 }} aria-hidden="true">{g.icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.label}</span>
                    </div>
                    {g.categories.map((cat) => {
                      const cm = getCategoryMeta(cat)
                      const sel = cat === value
                      const hasSubs = (SUBCATEGORIES[cat] ?? []).length > 0
                      return (
                        <button
                          key={cat}
                          onClick={() => chooseCategory(cat)}
                          className={cn("w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-md text-left transition-colors", sel ? "bg-primary-muted" : "hover:bg-background-secondary")}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cm.hex }} />
                          <span className={cn("text-xs truncate flex-1", sel ? "text-primary font-medium" : "text-foreground")}>{cat}</span>
                          {hasSubs && <span className="material-symbols-rounded text-foreground-muted/50 flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">chevron_right</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setPickedCat(null); setCustomSub("") }}
                className="w-full flex items-center gap-1 px-1.5 py-1 mb-1 text-xs font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">chevron_left</span>
                <span className="truncate">{pickedCat}</span>
              </button>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted px-1.5 pb-1">Subcategory</p>
              <div className="max-h-52 overflow-y-auto scroll-touch">
                {subs.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => chooseSub(sub)}
                    className="w-full px-3 py-1.5 rounded-md text-left text-xs text-foreground hover:bg-background-secondary transition-colors"
                  >
                    {sub}
                  </button>
                ))}
                <button
                  onClick={() => chooseSub(null)}
                  className="w-full px-3 py-1.5 rounded-md text-left text-xs text-foreground-muted italic hover:bg-background-secondary transition-colors"
                >
                  No subcategory
                </button>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); const v = customSub.trim(); if (v) chooseSub(v) }}
                className="mt-2 flex items-center gap-1.5"
              >
                <input
                  value={customSub}
                  onChange={(e) => setCustomSub(e.target.value)}
                  placeholder="Custom…"
                  className="flex-1 min-w-0 bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!customSub.trim()}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  Set
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

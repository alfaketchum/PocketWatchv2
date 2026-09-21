"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { CATEGORY_GROUPS, getCategoryMeta } from "@/lib/finance/categories"
import { usePopoverAlign } from "@/hooks/finance/use-popover-align"

const PANEL_WIDTH = 256 // w-64

interface CategoryPickerProps {
  value: string | null
  onSelect: (category: string) => void
  align?: "left" | "right"
}

/**
 * Grouped category picker — a pop-out list of categories organized by group
 * (Income · Expenses · Investments · Transfers · Other), searchable. Used to
 * re-categorize a transaction inline.
 */
export function CategoryPicker({ value, onSelect, align = "left" }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  // Flip to right-alignment when a left-opening panel would run off the page,
  // so the picker always fits on screen regardless of the caller's `align`.
  const overflowsRight = usePopoverAlign(ref, open, PANEL_WIDTH)
  const alignRight = align === "right" || overflowsRight
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    return CATEGORY_GROUPS
      .map((g) => ({ ...g, categories: query ? g.categories.filter((c) => c.toLowerCase().includes(query)) : g.categories }))
      .filter((g) => g.categories.length > 0)
  }, [q])

  const pick = (cat: string) => { onSelect(cat); setOpen(false); setQ("") }

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
                  return (
                    <button
                      key={cat}
                      onClick={() => pick(cat)}
                      className={cn("w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-md text-left transition-colors", sel ? "bg-primary-muted" : "hover:bg-background-secondary")}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cm.hex }} />
                      <span className={cn("text-xs truncate", sel ? "text-primary font-medium" : "text-foreground")}>{cat}</span>
                      {sel && <span className="material-symbols-rounded text-primary ml-auto" style={{ fontSize: 14 }} aria-hidden="true">check</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CATEGORY_GROUPS, getCategoryMeta } from "@/lib/finance/categories"
import { usePopoverAlign } from "@/hooks/finance/use-popover-align"

const PANEL_WIDTH = 440 // w-[440px]

interface TransactionCategoryFilterProps {
  selected: string[]
  onToggle: (category: string) => void
  onClear: () => void
}

/** Multi-select category filter chip → grouped popover (Income / Expenses / …). */
export function TransactionCategoryFilter({ selected, onToggle, onClear }: TransactionCategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Flip to right-alignment when the panel would run off the right edge of the
  // page, so the full popover stays on screen.
  const alignRight = usePopoverAlign(ref, open, PANEL_WIDTH)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const has = selected.length > 0
  const label = selected.length === 0 ? "All categories" : selected.length === 1 ? selected[0] : `${selected.length} categories`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[200px]",
          has ? "bg-primary-muted border-primary/30 text-primary" : "bg-background-secondary border-card-border text-foreground-muted hover:text-foreground",
        )}
      >
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">category</span>
        <span className="truncate">{label}</span>
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className={cn("absolute top-full mt-1.5 z-50 w-[440px] max-w-[calc(100vw-1.5rem)] bg-card border border-card-border rounded-xl shadow-xl p-3 max-h-[420px] overflow-y-auto scroll-touch animate-in fade-in slide-in-from-top-1 duration-150", alignRight ? "right-0" : "left-0")}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-foreground">Filter categories</span>
            {has && <button onClick={onClear} className="text-[11px] font-medium text-primary hover:text-primary-hover">Clear ({selected.length})</button>}
          </div>
          {CATEGORY_GROUPS.map((g) => (
            <div key={g.label} className="mb-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-rounded text-foreground-muted/70" style={{ fontSize: 13 }} aria-hidden="true">{g.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {g.categories.map((cat) => {
                  const cm = getCategoryMeta(cat)
                  const sel = selected.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => onToggle(cat)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left border transition-colors",
                        sel ? "bg-primary-muted border-primary/30" : "border-card-border hover:bg-background-secondary",
                      )}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cm.hex }} />
                      <span className={cn("text-[11px] flex-1 leading-tight", sel ? "text-primary font-medium" : "text-foreground")}>{cat}</span>
                      {sel && <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">check</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

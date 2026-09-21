"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CATEGORY_GROUPS, getCategoryMeta } from "@/lib/finance/categories"

interface TransactionCategoryFilterProps {
  value: string
  onChange: (category: string) => void
}

/** Category filter chip → grouped popover (Income / Expenses / Investments / …). */
export function TransactionCategoryFilter({ value, onChange }: TransactionCategoryFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const meta = value ? getCategoryMeta(value) : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[200px]",
          value ? "bg-primary-muted border-primary/30" : "bg-background-secondary border-card-border text-foreground-muted hover:text-foreground",
        )}
        style={value && meta ? { color: meta.hex, borderColor: `color-mix(in srgb, ${meta.hex} 40%, transparent)` } : undefined}
      >
        {value && meta ? (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.hex }} />
        ) : (
          <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">category</span>
        )}
        <span className="truncate">{value || "All categories"}</span>
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-60 bg-card border border-card-border rounded-xl shadow-xl p-2 max-h-[360px] overflow-y-auto scroll-touch animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { onChange(""); setOpen(false) }}
            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors", !value ? "bg-primary-muted text-primary font-medium" : "text-foreground hover:bg-background-secondary")}
          >
            All categories
          </button>
          {CATEGORY_GROUPS.map((g) => (
            <div key={g.label} className="mt-1">
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
                    onClick={() => { onChange(cat); setOpen(false) }}
                    className={cn("w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-md text-left transition-colors", sel ? "bg-primary-muted" : "hover:bg-background-secondary")}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cm.hex }} />
                    <span className={cn("text-xs truncate", sel ? "text-primary font-medium" : "text-foreground")}>{cat}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

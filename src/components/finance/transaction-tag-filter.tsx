"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"

interface TransactionTagFilterProps {
  value: string
  onChange: (tag: string) => void
  /** Tags seen in the current result set — offered as quick-picks. */
  available: string[]
}

/** Single-tag filter chip → popover with quick-picks + free-text. */
export function TransactionTagFilter({ value, onChange, available }: TransactionTagFilterProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const options = useMemo(() => {
    const uniq = [...new Set(available.map((t) => t.toLowerCase()))].sort()
    const query = q.trim().toLowerCase()
    return query ? uniq.filter((t) => t.includes(query)) : uniq
  }, [available, q])

  const pick = (t: string) => { onChange(t); setOpen(false); setQ("") }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[200px]",
          value ? "bg-primary-muted border-primary/30 text-primary" : "bg-background-secondary border-card-border text-foreground-muted hover:text-foreground",
        )}
      >
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">sell</span>
        <span className="truncate">{value || "Tag"}</span>
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-[240px] bg-card border border-card-border rounded-xl shadow-xl p-2.5 max-h-[360px] overflow-y-auto scroll-touch animate-in fade-in slide-in-from-top-1 duration-150">
          <form onSubmit={(e) => { e.preventDefault(); const t = q.trim().toLowerCase(); if (t) pick(t) }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by tag…"
              className="w-full bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder-foreground-muted mb-2 focus:border-primary focus:outline-none"
            />
          </form>
          {value && (
            <button onClick={() => pick("")} className="w-full text-left px-2 py-1.5 rounded-md text-xs text-primary hover:bg-background-secondary transition-colors mb-1">Clear filter</button>
          )}
          {options.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-2">No tags{q ? " match" : " yet"}</p>
          ) : options.map((t) => (
            <button
              key={t}
              onClick={() => pick(t)}
              className={cn("w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-xs transition-colors", t === value ? "bg-primary-muted text-primary" : "text-foreground hover:bg-background-secondary")}
            >
              <span className="material-symbols-rounded text-foreground-muted/70" style={{ fontSize: 13 }} aria-hidden="true">sell</span>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

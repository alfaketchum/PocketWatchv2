"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { TagEditor } from "./tag-editor"

interface TagCellProps {
  tags: string[]
  onSave: (tags: string[]) => void
}

/** Inline tag editor for a table cell — shows tag chips + an edit button that
 *  opens a small pop-out editor. Shared by the budget and transactions tables. */
export function TagCell({ tags, onSave }: TagCellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const has = tags.length > 0

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1 max-w-[170px]">
      {tags.slice(0, 2).map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-full border border-card-border text-foreground-muted text-[10px] font-medium px-1.5 py-0.5 max-w-[80px] truncate">
          <span className="material-symbols-rounded" style={{ fontSize: 10 }} aria-hidden="true">sell</span>{t}
        </span>
      ))}
      {tags.length > 2 && <span className="text-[10px] text-foreground-muted">+{tags.length - 2}</span>}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors flex-shrink-0", has ? "text-primary hover:bg-primary-muted" : "text-foreground-muted/60 hover:text-foreground hover:bg-background-secondary")}
        title="Edit tags"
        aria-label="Edit tags"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">{has ? "sell" : "new_label"}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-56 bg-card border border-card-border rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <TagEditor tags={tags} onSave={onSave} />
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface NoteCellProps {
  note: string | null
  onSave: (note: string) => void
}

/** Inline note editor rendered inside a table cell — a note icon that opens a
 *  small pop-out textarea. Shared by the budget and transactions tables. */
export function NoteCell({ note, onSave }: NoteCellProps) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(note ?? "")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => { setVal(note ?? ""); setOpen((o) => !o) }}
        className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors", note ? "text-primary hover:bg-primary-muted" : "text-foreground-muted/60 hover:text-foreground hover:bg-background-secondary")}
        title={note || "Add note"}
        aria-label="Note"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">{note ? "sticky_note_2" : "note_add"}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-56 bg-card border border-card-border rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <textarea
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={3}
            placeholder="Add a note..."
            className="w-full bg-background border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground placeholder-foreground-muted focus:border-primary focus:outline-none resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setOpen(false)} className="text-[11px] text-foreground-muted hover:text-foreground px-2 py-1">Cancel</button>
            <button onClick={() => { onSave(val.trim()); setOpen(false) }} className="text-[11px] font-semibold text-white bg-primary rounded-md px-2.5 py-1 hover:bg-primary-hover transition-colors">Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

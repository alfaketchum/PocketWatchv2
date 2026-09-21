"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { normalizeType, TYPE_ICONS } from "@/components/finance/accounts/accounts-constants"

interface Acct { id: string; name: string; mask: string | null; type: string; subtype: string | null }
interface Inst { id: string; institutionName: string; provider: string; accounts: Acct[] }

const TYPE_LABEL: Record<string, string> = {
  checking: "Checking", savings: "Savings", credit: "Credit", investment: "Investment", loan: "Loans",
}
const TYPE_ORDER = ["checking", "savings", "credit", "investment", "loan"]

interface TransactionAccountFilterProps {
  institutions: Inst[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}

/** Multi-select account filter chip → grouped popover (Institution → type → accounts). */
export function TransactionAccountFilter({ institutions, selected, onToggle, onClear }: TransactionAccountFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const has = selected.length > 0
  const single = selected.length === 1 ? institutions.flatMap((i) => i.accounts).find((a) => a.id === selected[0]) : null
  const label = selected.length === 0 ? "All accounts" : single ? `${single.name}${single.mask ? ` ••${single.mask}` : ""}` : `${selected.length} accounts`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[220px]",
          has ? "bg-primary-muted border-primary/30 text-primary" : "bg-background-secondary border-card-border text-foreground-muted hover:text-foreground",
        )}
      >
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">account_balance</span>
        <span className="truncate">{label}</span>
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-[320px] bg-card border border-card-border rounded-xl shadow-xl p-3 max-h-[420px] overflow-y-auto scroll-touch animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-foreground">Filter accounts</span>
            {has && <button onClick={onClear} className="text-[11px] font-medium text-primary hover:text-primary-hover">Clear ({selected.length})</button>}
          </div>
          {institutions.map((inst) => {
            const byType = new Map<string, Acct[]>()
            for (const a of inst.accounts) {
              const t = normalizeType(a.type)
              const arr = byType.get(t) ?? []
              arr.push(a)
              byType.set(t, arr)
            }
            const types = [...byType.keys()].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))
            return (
              <div key={inst.id} className="mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground truncate mb-0.5">{inst.institutionName}</div>
                {types.map((type) => (
                  <div key={type} className="mb-1">
                    <div className="px-1 text-[9px] uppercase tracking-wide text-foreground-muted/70">{TYPE_LABEL[type] ?? type}</div>
                    {byType.get(type)!.map((a) => {
                      const sel = selected.includes(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => onToggle(a.id)}
                          className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left border transition-colors", sel ? "bg-primary-muted border-primary/30" : "border-transparent hover:bg-background-secondary")}
                        >
                          <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">{TYPE_ICONS[a.type] ?? "account_balance"}</span>
                          <span className={cn("text-[11px] truncate flex-1", sel ? "text-primary font-medium" : "text-foreground")}>{a.name}{a.mask ? ` ••${a.mask}` : ""}</span>
                          {sel && <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">check</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

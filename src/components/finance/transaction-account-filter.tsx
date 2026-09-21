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
  value: string
  onChange: (id: string) => void
}

/** Account filter chip → grouped popover (Institution → account type → accounts). */
export function TransactionAccountFilter({ institutions, value, onChange }: TransactionAccountFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const selected = value ? institutions.flatMap((i) => i.accounts).find((a) => a.id === value) : null
  const label = selected ? `${selected.name}${selected.mask ? ` ••${selected.mask}` : ""}` : "All accounts"

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[220px]",
          selected ? "bg-primary-muted border-primary/30 text-primary" : "bg-background-secondary border-card-border text-foreground-muted hover:text-foreground",
        )}
      >
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">account_balance</span>
        <span className="truncate">{label}</span>
        <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-72 bg-card border border-card-border rounded-xl shadow-xl p-2 max-h-[360px] overflow-y-auto scroll-touch animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { onChange(""); setOpen(false) }}
            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors", !value ? "bg-primary-muted text-primary font-medium" : "text-foreground hover:bg-background-secondary")}
          >
            All accounts
          </button>

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
              <div key={inst.id} className="mt-1.5">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground truncate">{inst.institutionName}</div>
                {types.map((type) => (
                  <div key={type}>
                    <div className="px-2 py-0.5 text-[9px] uppercase tracking-wide text-foreground-muted/70">{TYPE_LABEL[type] ?? type}</div>
                    {byType.get(type)!.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { onChange(a.id); setOpen(false) }}
                        className={cn("w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-md text-left transition-colors", a.id === value ? "bg-primary-muted" : "hover:bg-background-secondary")}
                      >
                        <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">{TYPE_ICONS[a.type] ?? "account_balance"}</span>
                        <span className={cn("text-xs truncate", a.id === value ? "text-primary font-medium" : "text-foreground")}>{a.name}{a.mask ? ` ••${a.mask}` : ""}</span>
                      </button>
                    ))}
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

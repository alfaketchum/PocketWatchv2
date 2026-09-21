"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn, formatCurrency } from "@/lib/utils"
import { useFinanceAccounts } from "@/hooks/use-finance"
import {
  GROUP_META, ASSET_ORDER, LIABILITY_ORDER, buildAccountGroups, sumGroups,
  type GroupKey,
} from "@/components/net-worth/account-groups"

const OPEN_KEY = "pw-sidebar-networth-open"
const DEFAULT_OPEN = ["assets", "liabilities", "cash", "investment", "other", "credit", "loan"]

const SECTIONS: Array<{ id: string; label: string; order: GroupKey[] }> = [
  { id: "assets", label: "Assets", order: ASSET_ORDER },
  { id: "liabilities", label: "Liabilities", order: LIABILITY_ORDER },
]

/**
 * Vertical Net Worth breakdown nested under the existing "Net Worth" sidebar
 * item: Assets / Liabilities → account groups → accounts, each level
 * collapsible with persisted open state. Hidden on the desktop icon-rail.
 */
export function SidebarNetWorth({ collapsed }: { collapsed?: boolean }) {
  const { data: institutions } = useFinanceAccounts()
  const [open, setOpen] = useState<Set<string>>(() => new Set(DEFAULT_OPEN))

  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY)
      if (v) setOpen(new Set(JSON.parse(v) as string[]))
    } catch { /* ignore */ }
  }, [])

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  const groups = buildAccountGroups(institutions)
  const anyAccounts = [...ASSET_ORDER, ...LIABILITY_ORDER].some((k) => groups[k].length > 0)
  if (!anyAccounts) return null

  return (
    <div className={cn("mt-0.5 space-y-0.5", collapsed && "lg:hidden")} suppressHydrationWarning>
      {SECTIONS.map((sec) => {
        const visibleGroups = sec.order.filter((k) => groups[k].length > 0)
        if (visibleGroups.length === 0) return null
        const sOpen = open.has(sec.id)
        return (
          <div key={sec.id}>
            {/* Section: Assets / Liabilities */}
            <button
              onClick={() => toggle(sec.id)}
              className="w-full flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-md hover:bg-background-secondary transition-colors"
              aria-expanded={sOpen}
            >
              <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", sOpen && "rotate-90")} style={{ fontSize: 14 }} aria-hidden="true">chevron_right</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{sec.label}</span>
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-foreground">{formatCurrency(sumGroups(groups, visibleGroups))}</span>
            </button>

            {sOpen && visibleGroups.map((k) => {
              const rows = groups[k]
              const groupTotal = rows.reduce((s, r) => s + r.balance, 0)
              const gOpen = open.has(k)
              return (
                <div key={k}>
                  {/* Group: Cash / Investments / Credit / Loans */}
                  <button
                    onClick={() => toggle(k)}
                    className="w-full flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md hover:bg-background-secondary transition-colors"
                    aria-expanded={gOpen}
                  >
                    <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">{GROUP_META[k].icon}</span>
                    <span className="text-[11px] font-medium text-foreground truncate">{GROUP_META[k].label}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-foreground-muted">{formatCurrency(groupTotal)}</span>
                    <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", gOpen && "rotate-180")} style={{ fontSize: 13 }} aria-hidden="true">expand_more</span>
                  </button>

                  {gOpen && rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 pl-12 pr-2 py-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground truncate leading-tight">{r.name}</p>
                        {r.mask && <p className="text-[9px] text-foreground-muted leading-tight">••{r.mask}</p>}
                      </div>
                      {r.needsReconnect ? (
                        <Link href="/finance/accounts" className="text-[10px] font-medium text-primary hover:text-primary-hover flex-shrink-0">Reconnect</Link>
                      ) : (
                        <span className="text-[11px] tabular-nums text-foreground-muted flex-shrink-0">{formatCurrency(r.balance)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

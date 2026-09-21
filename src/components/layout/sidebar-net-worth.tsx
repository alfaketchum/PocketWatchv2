"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn, formatCurrency } from "@/lib/utils"
import { useFinanceAccounts } from "@/hooks/use-finance"
import {
  GROUP_META, ASSET_ORDER, LIABILITY_ORDER, buildAccountGroups,
  type GroupKey,
} from "@/components/net-worth/account-groups"

const OPEN_KEY = "pw-sidebar-networth-groups"
const DEFAULT_OPEN: GroupKey[] = ["cash", "investment", "other", "credit", "loan"]

/**
 * Compact, vertical account breakdown nested under the existing "Net Worth"
 * sidebar item. Each account group expands/collapses (persisted). Hidden on
 * the desktop icon-rail (collapsed) via lg-scoped classes.
 */
export function SidebarNetWorth({ collapsed }: { collapsed?: boolean }) {
  const { data: institutions } = useFinanceAccounts()
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(() => new Set(DEFAULT_OPEN))
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY)
      if (v) setOpenGroups(new Set(JSON.parse(v) as GroupKey[]))
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  const toggleGroup = (k: GroupKey) => setOpenGroups((prev) => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  const groups = buildAccountGroups(institutions)
  const visible = [...ASSET_ORDER, ...LIABILITY_ORDER].filter((k) => groups[k].length > 0)
  if (visible.length === 0) return null

  return (
    <div className={cn("mt-0.5 space-y-0.5", collapsed && "lg:hidden")} suppressHydrationWarning>
      {visible.map((k) => {
        const rows = groups[k]
        const groupTotal = rows.reduce((s, r) => s + r.balance, 0)
        const gOpen = hydrated && openGroups.has(k)
        return (
          <div key={k}>
            <button
              onClick={() => toggleGroup(k)}
              className="w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md hover:bg-background-secondary transition-colors"
              aria-expanded={gOpen}
            >
              <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">{GROUP_META[k].icon}</span>
              <span className="text-[11px] font-medium text-foreground truncate">{GROUP_META[k].label}</span>
              <span className="ml-auto text-[11px] tabular-nums text-foreground-muted">{formatCurrency(groupTotal)}</span>
              <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", gOpen && "rotate-180")} style={{ fontSize: 14 }} aria-hidden="true">expand_more</span>
            </button>

            {gOpen && rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 pl-11 pr-2 py-1">
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
}

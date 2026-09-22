"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, formatCurrency } from "@/lib/utils"
import { useFinanceAccounts } from "@/hooks/use-finance"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { BlurredValue } from "@/components/portfolio/blurred-value"
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
  const pathname = usePathname()
  const { data: institutions, refetch } = useFinanceAccounts()
  const { data: netWorth } = useCombinedNetWorth()
  const { isHidden } = usePrivacyMode()
  const [open, setOpen] = useState<Set<string>>(() => new Set(DEFAULT_OPEN))

  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY)
      if (v) setOpen(new Set(JSON.parse(v) as string[]))
    } catch { /* ignore */ }
  }, [])

  // This sidebar is mounted once in the persistent dashboard layout, and the
  // global query config uses refetchOnMount:false — so if the initial accounts
  // fetch is missed or fails (e.g. a cookie race right after login) it would
  // stay empty until a hard refresh. Recover by refetching on navigation while
  // there's no data (a populated list, even empty [], stops this).
  useEffect(() => {
    if (institutions === undefined) refetch()
  }, [pathname, institutions, refetch])

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
    return next
  })

  const groups = buildAccountGroups(institutions)

  // Surface the crypto portfolio as its own Stablecoins / Digital Assets asset
  // groups so the sidebar reflects total net worth, not just finance accounts.
  const stablecoins = netWorth?.crypto?.stablecoins ?? 0
  const digitalAssets = netWorth?.crypto?.digitalAssets ?? 0
  if (stablecoins > 0) {
    groups.stablecoin = [
      { id: "stablecoins", name: "Wallets", mask: null, type: "crypto", balance: stablecoins, synced: null, needsReconnect: false },
    ]
  }
  if (digitalAssets > 0) {
    groups.digital = [
      { id: "digital-assets", name: "Wallets", mask: null, type: "crypto", balance: digitalAssets, synced: null, needsReconnect: false },
    ]
  }

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
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-foreground"><BlurredValue isHidden={isHidden}>{formatCurrency(sumGroups(groups, visibleGroups))}</BlurredValue></span>
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
                    <span className="ml-auto text-[11px] tabular-nums text-foreground-muted"><BlurredValue isHidden={isHidden}>{formatCurrency(groupTotal)}</BlurredValue></span>
                    <span className={cn("material-symbols-rounded text-foreground-muted transition-transform flex-shrink-0", gOpen && "rotate-180")} style={{ fontSize: 13 }} aria-hidden="true">expand_more</span>
                  </button>

                  {gOpen && rows.map((r) => {
                    const inner = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-foreground truncate leading-tight">{r.name}</p>
                          {r.mask && <p className="text-[9px] text-foreground-muted leading-tight">••{r.mask}</p>}
                        </div>
                        {r.needsReconnect ? (
                          <Link href="/finance/accounts" className="text-[10px] font-medium text-primary hover:text-primary-hover flex-shrink-0">Reconnect</Link>
                        ) : (
                          <span className="text-[11px] tabular-nums text-foreground-muted flex-shrink-0"><BlurredValue isHidden={isHidden}>{formatCurrency(r.balance)}</BlurredValue></span>
                        )}
                      </>
                    )
                    // Crypto rows link through to the portfolio; finance rows are static.
                    return r.type === "crypto" ? (
                      <Link key={r.id} href="/portfolio" className="flex items-center gap-2 pl-12 pr-2 py-1 rounded-md hover:bg-background-secondary transition-colors">{inner}</Link>
                    ) : (
                      <div key={r.id} className="flex items-center gap-2 pl-12 pr-2 py-1">{inner}</div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, formatCurrency } from "@/lib/utils"
import { useFinanceAccounts } from "@/hooks/use-finance"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { useNetWorthTimeframe, daysForTf, SIDEBAR_TIMEFRAMES } from "@/hooks/use-net-worth-timeframe"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { NetWorthTimeframeToggle } from "@/components/net-worth/net-worth-timeframe-toggle"
import {
  GROUP_META, ASSET_ORDER, LIABILITY_ORDER, buildAccountGroups, sumGroups,
  type GroupKey,
} from "@/components/net-worth/account-groups"

const OPEN_KEY = "pw-sidebar-networth-open"
const DEFAULT_OPEN = ["assets", "liabilities", "cash", "savings", "investment", "stablecoin", "digital", "other", "credit", "loan"]

const SECTIONS: Array<{ id: string; label: string; order: GroupKey[] }> = [
  { id: "assets", label: "Assets", order: ASSET_ORDER },
  { id: "liabilities", label: "Liabilities", order: LIABILITY_ORDER },
]

function changeColor(v: number): string {
  return v > 0 ? "text-emerald-500" : v < 0 ? "text-red-500" : "text-foreground-muted"
}

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
  const { tf: selectedTf, select: selectTf } = useNetWorthTimeframe()
  // The page chart offers longer ranges (6M / 1Y / ALL); the widget caps at 3M.
  const tf = SIDEBAR_TIMEFRAMES.some((t) => t.key === selectedTf) ? selectedTf : "3M"
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

  // Change over the selected lookback: total (from history) + per group (from
  // the per-day breakdown). Baseline = earliest point within the window.
  const cutoffMs = Date.now() - daysForTf(tf) * 86_400_000
  const hist = netWorth?.history ?? []
  const totalNow = netWorth?.totalNetWorth ?? 0
  const totalBase = (hist.find((h) => new Date(h.date).getTime() >= cutoffMs) ?? hist[0])?.total ?? 0
  const totalChange = totalNow - totalBase
  const totalPct = totalBase !== 0 ? (totalChange / totalBase) * 100 : 0

  const bh = netWorth?.breakdownHistory ?? []
  const bdBase = bh.find((h) => new Date(h.date).getTime() >= cutoffMs) ?? bh[0]
  const bdLast = bh[bh.length - 1]
  const groupChange = (k: GroupKey): number | null => {
    if (!bdBase || !bdLast) return null
    const last = (bdLast as unknown as Record<string, number>)[k]
    const base = (bdBase as unknown as Record<string, number>)[k]
    return last === undefined || base === undefined ? null : last - base
  }

  return (
    <div className={cn("mt-0.5 space-y-0.5", collapsed && "lg:hidden")} suppressHydrationWarning>
      {/* Net worth header: total, change over the lookback, and the D/W/M/3M toggle */}
      {netWorth && (
        <div className="px-4 pt-1 pb-3 mb-1 border-b border-card-border/60">
          <div className="text-lg font-semibold tabular-nums text-foreground leading-tight">
            <BlurredValue isHidden={isHidden}>{formatCurrency(totalNow)}</BlurredValue>
          </div>
          <div className={cn("flex items-center gap-1 mt-1 text-[11px] font-medium tabular-nums", changeColor(totalChange))}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              {totalChange > 0 ? "trending_up" : totalChange < 0 ? "trending_down" : "trending_flat"}
            </span>
            {totalPct >= 0 ? "+" : ""}{totalPct.toFixed(1)}%
            <span className="text-foreground-muted mx-0.5">·</span>
            <BlurredValue isHidden={isHidden}>{formatCurrency(Math.abs(totalChange))}</BlurredValue>
          </div>
          <NetWorthTimeframeToggle value={tf} onSelect={selectTf} size="sm" className="mt-2.5" options={SIDEBAR_TIMEFRAMES} />
        </div>
      )}

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
              const gc = groupChange(k)
              return (
                <div key={k}>
                  {/* Group: Cash / Savings / Investments / Stablecoins / Digital Assets / … */}
                  <button
                    onClick={() => toggle(k)}
                    className="w-full flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md hover:bg-background-secondary transition-colors"
                    aria-expanded={gOpen}
                  >
                    <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 15 }} aria-hidden="true">{GROUP_META[k].icon}</span>
                    <span className="text-[11px] font-medium text-foreground truncate">{GROUP_META[k].label}</span>
                    <div className="ml-auto flex flex-col items-end leading-tight">
                      <span className="text-[11px] tabular-nums text-foreground-muted"><BlurredValue isHidden={isHidden}>{formatCurrency(groupTotal)}</BlurredValue></span>
                      {gc !== null && gc !== 0 && (
                        <span className={cn("text-[9px] tabular-nums", changeColor(gc))}>
                          {gc > 0 ? "+" : "−"}<BlurredValue isHidden={isHidden}>{formatCurrency(Math.abs(gc))}</BlurredValue>
                        </span>
                      )}
                    </div>
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

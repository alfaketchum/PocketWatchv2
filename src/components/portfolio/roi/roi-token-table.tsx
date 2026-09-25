"use client"

import { useMemo, useState } from "react"
import { formatCryptoAmount, formatFiatValue, formatPnL } from "@/lib/portfolio/utils"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { ScrollHintWrapper } from "@/components/ui/scroll-hint-wrapper"
import type { TokenRoiRow } from "@/types/roi"
import { formatRoi, formatUnitPrice } from "./roi-helpers"

type SortKey = "currentValue" | "costBasis" | "unrealizedGain" | "totalGain" | "roiPct"

const COLUMNS: Array<{ key: SortKey | null; label: string }> = [
  { key: null, label: "Avg entry" },
  { key: null, label: "Price" },
  { key: "costBasis", label: "Cost basis" },
  { key: "currentValue", label: "Value" },
  { key: "unrealizedGain", label: "Unrealized" },
  { key: "totalGain", label: "Total PnL" },
  { key: "roiPct", label: "ROI" },
]

const MASK = "••••"
const NUM = { fontVariantNumeric: "tabular-nums" } as const

export function RoiTokenTable({ tokens, isHidden }: { tokens: TokenRoiRow[]; isHidden: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("currentValue")
  const sorted = useMemo(
    () => [...tokens].sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity)),
    [tokens, sortKey],
  )

  if (tokens.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl py-12 text-center text-sm text-foreground-muted">
        No token cost basis yet — it's fetched in the background and appears within a minute.
      </div>
    )
  }

  const money = (v: number) => (isHidden ? MASK : formatFiatValue(v))
  const pnl = (v: number) => {
    const f = formatPnL(v)
    return <span className={f.colorClass}>{isHidden ? MASK : f.text}</span>
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <ScrollHintWrapper>
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground-muted">Asset</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  onClick={c.key ? () => setSortKey(c.key!) : undefined}
                  className={`px-4 py-3 text-right text-xs font-medium whitespace-nowrap ${c.key ? "cursor-pointer hover:text-foreground" : ""} ${c.key === sortKey ? "text-foreground" : "text-foreground-muted"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const roi = formatRoi(t.roiPct)
              return (
                <tr key={t.fungibleId} className="border-b border-card-border last:border-b-0 hover:bg-primary-subtle transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PortfolioAssetIcon asset={t.symbol} assetId={t.symbol} chain={t.chain} iconUrl={t.iconUrl ?? undefined} size={28} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-data text-sm font-medium truncate">{t.symbol}</span>
                          <ChainBadge chainId={t.chain} size="sm" />
                        </div>
                        <span className="text-foreground-muted font-data text-xs" style={NUM}>
                          {isHidden ? MASK : formatCryptoAmount(t.quantity, 4)}
                          {t.walletCount > 1 ? ` · ${t.walletCount} wallets` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground-muted" style={NUM}>{formatUnitPrice(t.averageBuyPrice)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground-muted" style={NUM}>{formatUnitPrice(t.currentPrice)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground-muted" style={NUM}>{money(t.costBasis)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground font-medium" style={NUM}>{money(t.currentValue)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm" style={NUM}>{pnl(t.unrealizedGain)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm" style={NUM}>{pnl(t.totalGain)}</td>
                  <td className={`px-4 py-3 text-right font-data text-sm font-medium ${roi.colorClass}`} style={NUM}>{roi.text}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollHintWrapper>
    </div>
  )
}

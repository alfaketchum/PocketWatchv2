"use client"

import { formatCryptoAmount, formatFiatValue, formatPnL, shortenAddress } from "@/lib/portfolio/utils"
import { ScrollHintWrapper } from "@/components/ui/scroll-hint-wrapper"
import type { VenuePnlRow } from "@/types/roi"
import { formatRoi, formatUnitPrice } from "./roi-helpers"

const VENUE_LABEL: Record<VenuePnlRow["venue"], string> = { hyperliquid: "Hyperliquid", lighter: "Lighter" }
const HEADERS = ["Venue", "Market", "Side", "Size", "Entry", "Value", "Unrealized", "ROI"]
const MASK = "••••"
const NUM = { fontVariantNumeric: "tabular-nums" } as const

/** Open Hyperliquid / Lighter positions, using each venue's own entry price and PnL. */
export function RoiVenueTable({ venues, isHidden }: { venues: VenuePnlRow[]; isHidden: boolean }) {
  if (venues.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl py-8 text-center text-sm text-foreground-muted">
        No open Hyperliquid or Lighter positions.
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <ScrollHintWrapper>
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              {HEADERS.map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap ${i < 3 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => {
              const pnl = formatPnL(v.unrealizedPnl)
              const roi = formatRoi(v.roiPct)
              return (
                <tr key={`${v.venue}-${v.walletAddress}-${v.kind}-${v.market}`} className="border-b border-card-border last:border-b-0 hover:bg-primary-subtle transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{VENUE_LABEL[v.venue]}</div>
                    <div className="text-xs text-foreground-muted font-data">{shortenAddress(v.walletAddress)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground font-data font-medium">
                    {v.market}
                    <span className="ml-2 text-xs text-foreground-muted font-normal">{v.kind === "perp" ? "Perp" : "Spot"}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {v.side ? (
                      <span className={v.side === "long" ? "text-success" : "text-error"}>
                        {v.side === "long" ? "Long" : "Short"}{v.leverage ? ` ${v.leverage}x` : ""}
                      </span>
                    ) : <span className="text-foreground-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground-muted" style={NUM}>{isHidden ? MASK : formatCryptoAmount(v.size, 4)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground-muted" style={NUM}>{formatUnitPrice(v.entryPrice)}</td>
                  <td className="px-4 py-3 text-right font-data text-sm text-foreground font-medium" style={NUM}>{isHidden ? MASK : formatFiatValue(v.positionValue)}</td>
                  <td className={`px-4 py-3 text-right font-data text-sm ${pnl.colorClass}`} style={NUM}>{isHidden ? MASK : pnl.text}</td>
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

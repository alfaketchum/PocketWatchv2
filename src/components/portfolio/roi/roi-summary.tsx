"use client"

import { formatFiatValue, formatPnL } from "@/lib/portfolio/utils"
import { formatRelativeTime } from "@/lib/utils"
import { PortfolioStatCard } from "@/components/portfolio/portfolio-stat-card"
import type { RoiResponse } from "@/types/roi"
import { formatRoi } from "./roi-helpers"

interface Props {
  data: RoiResponse | undefined
  isLoading: boolean
  isHidden: boolean
}

const MASK = "••••••"

/** Token totals (excludes stablecoins and Hyperliquid / Lighter, which have their own table). */
export function RoiSummary({ data, isLoading, isHidden }: Props) {
  const t = data?.totals
  const show = (text: string) => (isHidden ? MASK : text)
  const roi = formatRoi(t?.roiPct ?? null)
  const unrealized = formatPnL(t?.unrealized ?? 0)
  const realized = formatPnL(t?.realized ?? 0)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PortfolioStatCard label="Cost basis" icon="payments" isLoading={isLoading} value={show(formatFiatValue(t?.costBasis ?? 0))} />
        <PortfolioStatCard label="Current value" icon="account_balance_wallet" isLoading={isLoading} value={show(formatFiatValue(t?.value ?? 0))} />
        <PortfolioStatCard
          label="Unrealized PnL" icon="trending_up" isLoading={isLoading} value={show(unrealized.text)}
          change={{ value: `Realized ${isHidden ? MASK : realized.text}`, positive: (t?.realized ?? 0) >= 0 }}
        />
        <PortfolioStatCard
          label="ROI on holdings" icon="percent" isLoading={isLoading} value={roi.text}
          change={t ? { value: `Lifetime PnL ${show(formatPnL(t.totalGain).text)}`, positive: t.totalGain >= 0 } : undefined}
        />
      </div>
      <p className="text-xs text-foreground-muted">
        Cost basis from Zerion, refreshed daily
        {data?.refreshedAt ? ` · updated ${formatRelativeTime(data.refreshedAt)}` : ""}
        {data?.refreshing ? " · refreshing now…" : ""}
        {" · stablecoins and tokens under $100 excluded"}
      </p>
    </div>
  )
}

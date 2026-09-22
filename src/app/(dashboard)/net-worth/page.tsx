"use client"

import { useState } from "react"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { formatCurrency, cn } from "@/lib/utils"
import { FadeIn } from "@/components/motion/fade-in"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PrivacyToggle } from "@/components/portfolio/privacy-toggle"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { FinanceHeroCard } from "@/components/finance/finance-hero-card"
import { NumberPop } from "@/components/ui/number-pop"
import { NetWorthBreakdown } from "@/components/net-worth/net-worth-breakdown"
import { NetWorthAccountsBreakdown } from "@/components/net-worth/net-worth-accounts-breakdown"
import dynamic from "next/dynamic"

type Timeframe = "W" | "M" | "Y"
const TF_DAYS: Record<Timeframe, number> = { W: 7, M: 30, Y: 365 }
const TF_LABEL: Record<Timeframe, string> = { W: "7 days", M: "30 days", Y: "365 days" }
const NetWorthHistoryChart = dynamic(
  () => import("@/components/net-worth/net-worth-history-chart").then((m) => m.NetWorthHistoryChart),
  { ssr: false, loading: () => <div className="h-[260px] animate-shimmer rounded-xl" /> }
)

export default function NetWorthPage() {
  const { data, isLoading, isError } = useCombinedNetWorth()
  const { isHidden, togglePrivacy } = usePrivacyMode()
  const [timeframe, setTimeframe] = useState<Timeframe>("M")

  const totalNetWorth = data?.totalNetWorth ?? 0
  const fiat = data?.fiat ?? { cash: 0, savings: 0, investments: 0, debt: 0, netWorth: 0 }
  const crypto = data?.crypto ?? { value: 0, stablecoins: 0, digitalAssets: 0, snapshotAt: null }
  const history = data?.history ?? []

  // Period change over the selected timeframe: baseline = earliest point within
  // the window (history is ascending; falls back to the oldest point available).
  const cutoff = Date.now() - TF_DAYS[timeframe] * 86_400_000
  const baseline = history.find((h) => new Date(h.date).getTime() >= cutoff) ?? history[0]
  const firstTotal = baseline ? baseline.total : 0
  const delta = totalNetWorth - firstTotal
  const deltaPct = firstTotal !== 0 ? (delta / firstTotal) * 100 : 0

  // Per-group change over the same timeframe (from the category breakdown series).
  const bh = data?.breakdownHistory ?? []
  const bdBase = bh.find((h) => new Date(h.date).getTime() >= cutoff) ?? bh[0]
  const bdLast = bh[bh.length - 1]
  const groupChanges = bdBase && bdLast ? {
    cash: bdLast.cash - bdBase.cash,
    investment: bdLast.investment - bdBase.investment,
    credit: bdLast.credit - bdBase.credit,
    loan: bdLast.loan - bdBase.loan,
  } : undefined

  if (isError) {
    return (
      <div className="space-y-6">
        <Header isHidden={isHidden} togglePrivacy={togglePrivacy} />
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load net worth data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header isHidden={isHidden} togglePrivacy={togglePrivacy} />

      {/* Hero Card */}
      <FadeIn className="mt-6 mb-8">
        <FinanceHeroCard
          label="Total Net Worth"
          value={formatCurrency(totalNetWorth)}
          isLoading={isLoading}
          isHidden={isHidden}
          beam
          change={delta !== 0 && history.length > 1 ? {
            value: `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% (${formatCurrency(Math.abs(delta))})`,
            positive: delta >= 0,
          } : undefined}
          footerStats={[
            { label: "Finance", value: formatCurrency(fiat.netWorth), node: <NumberPop value={fiat.netWorth} format={(n) => formatCurrency(n)} /> },
            { label: "Digital Assets", value: formatCurrency(crypto.value), color: crypto.value > 0 ? "success" : undefined, node: <NumberPop value={crypto.value} format={(n) => formatCurrency(n)} /> },
            { label: "Debt", value: formatCurrency(-fiat.debt), color: fiat.debt > 0 ? "error" : undefined, node: <NumberPop value={-fiat.debt} format={(n) => formatCurrency(n)} /> },
          ]}
        >
          {/* Timeframe toggle */}
          <div className="flex justify-end mb-2">
            <div className="inline-flex items-center bg-background-secondary border border-card-border rounded-lg p-0.5">
              {(["W", "M", "Y"] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors",
                    timeframe === tf ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
                  )}
                  title={`Change over ${TF_LABEL[tf]}`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          {/* Chart */}
          {isLoading ? (
            <div className="h-[260px] animate-shimmer rounded-lg" />
          ) : (
            <NetWorthHistoryChart data={history} height={260} />
          )}
        </FinanceHeroCard>
      </FadeIn>

      {/* Breakdown */}
      <FadeIn delay={0.1}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted mb-3">
          Breakdown
        </p>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : (
          <NetWorthBreakdown
            fiatCash={fiat.cash}
            fiatSavings={fiat.savings}
            fiatInvestments={fiat.investments}
            fiatDebt={fiat.debt}
            stablecoins={crypto.stablecoins}
            digitalAssets={crypto.digitalAssets}
            totalNetWorth={totalNetWorth}
            isHidden={isHidden}
          />
        )}
      </FadeIn>

      {/* Accounts — collapsible groups (Assets / Liabilities) */}
      <FadeIn delay={0.15}>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground-muted">
              Accounts
            </p>
            <a href="/finance/accounts" className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
              + Connect account
            </a>
          </div>
          <NetWorthAccountsBreakdown isHidden={isHidden} changes={groupChanges} accountChanges={data?.accountChanges} timeframe={timeframe} />
        </div>
      </FadeIn>

      {/* Source cards */}
      <StaggerChildren className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4" staggerMs={80}>
        <StaggerItem>
          <SourceCard
            title="Finance"
            subtitle="Bank accounts, investments, credit cards"
            value={fiat.netWorth}
            icon="account_balance"
            href="/finance"
            isHidden={isHidden}
            isLoading={isLoading}
          />
        </StaggerItem>
        <StaggerItem>
          <SourceCard
            title="Digital Assets"
            subtitle="Wallets, exchanges, staking"
            value={crypto.value}
            icon="currency_bitcoin"
            href="/portfolio"
            isHidden={isHidden}
            isLoading={isLoading}
          />
        </StaggerItem>
      </StaggerChildren>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function Header({ isHidden, togglePrivacy }: { isHidden: boolean; togglePrivacy: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl text-foreground font-semibold">Net Worth</h1>
        <p className="text-xs text-foreground-muted mt-0.5">Combined view across all accounts</p>
      </div>
      <PrivacyToggle isHidden={isHidden} onToggle={togglePrivacy} />
    </div>
  )
}

function SourceCard({
  title,
  subtitle,
  value,
  icon,
  href,
  isHidden,
  isLoading,
}: {
  title: string
  subtitle: string
  value: number
  icon: string
  href: string
  isHidden: boolean
  isLoading: boolean
}) {
  return (
    <a
      href={href}
      className="bg-card rounded-xl p-5 flex items-center gap-4 group card-hover-lift transition-colors"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 22 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-foreground-muted">{subtitle}</p>
      </div>
      <div className="text-right">
        {isLoading ? (
          <div className="h-5 w-20 animate-shimmer rounded" />
        ) : (
          <p className={cn("text-sm font-semibold tabular-nums", value < 0 ? "text-error" : "text-foreground")}>
            <BlurredValue isHidden={isHidden}>{formatCurrency(value)}</BlurredValue>
          </p>
        )}
      </div>
      <span className="material-symbols-rounded text-foreground-muted group-hover:text-foreground transition-colors" style={{ fontSize: 18 }}>
        chevron_right
      </span>
    </a>
  )
}

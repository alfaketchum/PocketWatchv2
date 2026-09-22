"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { StaggerReveal } from "@/components/ui/stagger-reveal"
import { useNetWorthCategories, type NwCategory } from "@/hooks/use-net-worth-colors"

interface NetWorthBreakdownProps {
  fiatCash: number
  fiatSavings: number
  fiatInvestments: number
  fiatDebt: number
  stablecoins: number
  digitalAssets: number
  totalNetWorth: number
  isHidden: boolean
}

const HREF: Record<NwCategory, string> = {
  cash: "/finance/accounts",
  savings: "/finance/accounts",
  investment: "/finance/investments",
  stablecoin: "/portfolio",
  digital: "/portfolio",
  debt: "/finance/cards",
}

// Asset categories in display order (Debt is appended separately as a liability).
const ASSET_ORDER: NwCategory[] = ["cash", "savings", "investment", "stablecoin", "digital"]

export function NetWorthBreakdown({
  fiatCash,
  fiatSavings,
  fiatInvestments,
  fiatDebt,
  stablecoins,
  digitalAssets,
  totalNetWorth,
  isHidden,
}: NetWorthBreakdownProps) {
  const cats = useNetWorthCategories()

  const valueOf: Record<NwCategory, number> = {
    cash: fiatCash,
    savings: fiatSavings,
    investment: fiatInvestments,
    stablecoin: stablecoins,
    digital: digitalAssets,
    debt: -fiatDebt,
  }

  const assets = ASSET_ORDER
    .map((key) => ({ ...cats[key], value: valueOf[key] }))
    .filter((s) => s.value > 0)
  const positiveTotal = assets.reduce((sum, s) => sum + s.value, 0)

  const rows = [
    ...assets,
    ...(fiatDebt > 0 ? [{ ...cats.debt, value: -fiatDebt }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Allocation bar */}
      {positiveTotal > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-background-secondary">
          {assets.map((s) => (
            <div
              key={s.key}
              className="transition-[width] duration-500"
              style={{ width: `${(s.value / positiveTotal) * 100}%`, background: s.color }}
              title={`${s.label} · ${formatCurrency(s.value)}`}
            />
          ))}
        </div>
      )}

      {/* Item rows */}
      <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((item) => {
          const pct = totalNetWorth !== 0
            ? ((Math.abs(item.value) / Math.abs(totalNetWorth)) * 100).toFixed(1)
            : "0.0"

          return (
            <Link
              key={item.key}
              href={HREF[item.key]}
              className="flex items-center gap-3 bg-card rounded-xl px-4 py-3.5 card-hover-lift transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 20, color: item.color }}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-muted font-medium">{item.label}</p>
                <p className={cn("text-sm font-semibold tabular-nums", item.value < 0 ? "text-red-500" : "text-foreground")}>
                  <BlurredValue isHidden={isHidden}>
                    {formatCurrency(item.value)}
                  </BlurredValue>
                </p>
              </div>
              <span className="text-[10px] text-foreground-muted tabular-nums font-medium">
                {pct}%
              </span>
              <span className="material-symbols-rounded text-foreground-muted/40" style={{ fontSize: 16 }} aria-hidden="true">chevron_right</span>
            </Link>
          )
        })}
      </StaggerReveal>
    </div>
  )
}

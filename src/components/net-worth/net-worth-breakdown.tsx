"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { StaggerReveal } from "@/components/ui/stagger-reveal"

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

// Asset taxonomy (order matters). Each carries its icon + a bar/text color.
const ASSET_SEGMENTS = [
  { key: "cash",       label: "Cash",          icon: "account_balance",  bar: "bg-emerald-500", text: "text-emerald-500", href: "/finance/accounts" },
  { key: "savings",    label: "Savings",       icon: "savings",          bar: "bg-teal-500",    text: "text-teal-500",    href: "/finance/accounts" },
  { key: "investment", label: "Investments",   icon: "trending_up",      bar: "bg-violet-500",  text: "text-violet-500",  href: "/finance/investments" },
  { key: "stablecoin", label: "Stablecoins",   icon: "paid",             bar: "bg-sky-500",     text: "text-sky-500",     href: "/portfolio" },
  { key: "digital",    label: "Digital Assets", icon: "currency_bitcoin", bar: "bg-amber-500",  text: "text-amber-500",   href: "/portfolio" },
] as const

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
  const valueOf: Record<string, number> = {
    cash: fiatCash,
    savings: fiatSavings,
    investment: fiatInvestments,
    stablecoin: stablecoins,
    digital: digitalAssets,
  }

  const assets = ASSET_SEGMENTS.map((s) => ({ ...s, value: valueOf[s.key] })).filter((s) => s.value > 0)
  const positiveTotal = assets.reduce((sum, s) => sum + s.value, 0)

  const rows = [
    ...assets,
    ...(fiatDebt > 0
      ? [{ key: "debt", label: "Debt", icon: "credit_card", bar: "bg-red-500", text: "text-red-500", href: "/finance/cards", value: -fiatDebt }]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Allocation bar */}
      {positiveTotal > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-background-secondary">
          {assets.map((s) => (
            <div
              key={s.key}
              className={cn(s.bar, "transition-[width] duration-500")}
              style={{ width: `${(s.value / positiveTotal) * 100}%` }}
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
              href={item.href}
              className="flex items-center gap-3 bg-card rounded-xl px-4 py-3.5 card-hover-lift transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <span className={cn("material-symbols-rounded flex-shrink-0", item.text)} style={{ fontSize: 20 }}>
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

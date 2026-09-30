"use client"

import { useState } from "react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { RealAssetItem, RealAssetLoan } from "@/hooks/finance/use-real-assets"
import { formatCurrency } from "@/lib/utils"

const ICONS: Record<RealAssetItem["kind"], string> = { home: "home", vehicle: "directions_car", other: "category" }

function asOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** One home, vehicle or other asset: estimated value today, its loan and equity, and actions. */
export function RealAssetCard({
  asset,
  loan,
  isHidden,
  onEdit,
  onDelete,
}: {
  asset: RealAssetItem
  loan: RealAssetLoan | null
  isHidden: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const change = asset.appreciation
  return (
    <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-rounded text-primary bg-primary/10 rounded-xl p-2" style={{ fontSize: 20 }}>
            {ICONS[asset.kind]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
            <p className="text-[11px] text-foreground-muted">
              {formatCurrency(asset.value)} on {asOf(asset.valueAsOf)} · {change >= 0 ? "+" : ""}
              {(change * 100).toFixed(1)}%/yr since
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            <BlurredValue isHidden={isHidden}>{formatCurrency(asset.estimatedValue)}</BlurredValue>
          </p>
          <p className="text-[10px] text-foreground-muted">estimated today</p>
        </div>
      </div>
      {loan && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-foreground-muted">
            {loan.name}: <BlurredValue isHidden={isHidden}>{formatCurrency(loan.balance)}</BlurredValue> owed
          </span>
          <span className="text-foreground">
            Equity <BlurredValue isHidden={isHidden}>{formatCurrency(asset.estimatedValue - loan.balance)}</BlurredValue>
          </span>
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-foreground-muted self-center">Remove it and its value history?</span>
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost text-xs">
              Keep
            </button>
            <button type="button" onClick={onDelete} className="btn-secondary text-xs text-error">
              Remove
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirming(true)} className="btn-ghost text-xs">
              Remove
            </button>
            <button type="button" onClick={onEdit} className="btn-secondary text-xs">
              Update value / edit
            </button>
          </>
        )}
      </div>
    </div>
  )
}

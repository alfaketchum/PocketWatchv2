"use client"

import Link from "next/link"
import { fmtMoney } from "@/components/fire/fire-helpers"
import type { AssetCostLine } from "@/lib/plans/plan-asset-costs"

/** Detailed view: home and vehicle running costs, read-only, grouped by asset, with a link to edit them. */
export function AssetCostList({ lines }: { lines: AssetCostLine[] }) {
  if (lines.length === 0) return null
  const total = lines.filter((l) => l.expense.start.type === "planStart").reduce((s, l) => s + l.yearly, 0)
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-card-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Home &amp; vehicle costs</p>
        <Link href="?tab=assets" scroll={false} className="text-[11px] text-primary hover:underline">
          Edit on Assets &amp; debts →
        </Link>
      </div>
      <p className="text-[11px] text-foreground-muted">
        From your homes and vehicles, while you own them. Read-only here.{total > 0 ? ` ${fmtMoney(total)} a year today.` : ""}
      </p>
      <ul className="divide-y divide-card-border/60 text-xs">
        {lines.map(({ expense, yearly, followsValue }) => (
          <li key={expense.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-foreground">{expense.name}</span>
            <span className="tabular-nums text-foreground-muted">
              {fmtMoney(yearly)} / yr {followsValue ? "(follows value)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

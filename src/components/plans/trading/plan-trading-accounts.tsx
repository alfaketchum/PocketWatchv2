"use client"

import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { EmptyState } from "@/components/ui/empty-state"
import { tradingAccounts } from "@/lib/plans/plan-trading-compare"
import type { PlanDocument } from "@/lib/plans/plan-types"
import Link from "next/link"
import { PIN_FIRST_COLUMN_ON_PHONES } from "../editor/plan-table"
import { cn } from "@/lib/utils"

const COLUMNS = ["Account", "Balance", "Return / yr", "Sold each year", "Short-term"]

/** The plan's actively traded accounts and their tax settings, or how to mark one. */
export function PlanTradingAccounts({ doc, planId, isHidden }: { doc: PlanDocument; planId: string; isHidden: boolean }) {
  const accounts = tradingAccounts(doc)
  const accountsHref = `/plans/${planId}?tab=accounts`
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon="candlestick_chart"
        title="No actively traded accounts"
        description='Set "Realized each year" above 0% on a taxable account to mark it as traded. Its gains are then taxed every year, and this page compares trading it with holding it.'
        action={{ label: "Go to Accounts", href: accountsHref }}
      />
    )
  }
  return (
    <FireSectionCard
        eyebrow="Actively traded accounts"
        info="Gains in these accounts are taxed every year as they're realized, instead of when you withdraw. Change these on the Accounts tab."
        right={
          <Link href={accountsHref} className="btn-ghost text-xs">
            Edit on Accounts
          </Link>
        }
      >
        <div className="overflow-x-auto -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
          <table className={cn("w-full text-sm", PIN_FIRST_COLUMN_ON_PHONES)}>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
                {COLUMNS.map((c, i) => (
                  <th key={c} className={`px-3 py-2 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-card-border">
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(a.balance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(a.returnRate, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(a.realizedShare ?? 0, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(a.shortTermShare ?? 0, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </FireSectionCard>
  )
}

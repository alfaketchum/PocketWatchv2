"use client"

import { fmtPct } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { useTradingActivity } from "@/hooks/plans/use-trading-activity"
import type { PlanUpdater } from "@/hooks/plans/use-plan-document"
import {
  applyTradingSuggestion,
  pendingSuggestions,
  type PendingSuggestion,
  type TradingActivity,
} from "@/lib/plans/trading-detect"
import type { PlanDocument } from "@/lib/plans/plan-types"

const DAYS_PER_MONTH = 30.4

function evidence(a: TradingActivity): string {
  const months = Math.max(1, Math.round(a.spanDays / DAYS_PER_MONTH))
  const hold = a.medianHoldDays === null ? "" : ` · typical hold ${Math.round(a.medianHoldDays)} days`
  return `${a.trades} trades in ${months} months · sells ${a.turnover.toFixed(1)}× its balance a year${hold}`
}

function change(p: PendingSuggestion): string {
  const sold = `Sold each year ${fmtPct(p.account.realizedShare ?? 0, 0)} → ${fmtPct(p.suggestion.realizedShare, 0)}`
  const s = p.suggestion.shortTermShare
  return s === null ? sold : `${sold} · Short-term ${fmtPct(p.account.shortTermShare ?? 0, 0)} → ${fmtPct(s, 0)}`
}

/** Linked brokerage accounts whose trade history says they're traded more (or less) than the plan assumes. */
export function PlanTradingSuggestions({ doc, update }: { doc: PlanDocument; update: (updater: PlanUpdater) => void }) {
  const activity = useTradingActivity()
  if (activity.isLoading) return <div className="h-24 animate-shimmer rounded-2xl" />
  const pending = activity.data ? pendingSuggestions(doc, activity.data) : []
  if (pending.length === 0) return null

  const applyAll = () => update((d) => pending.reduce((acc, p) => applyTradingSuggestion(acc, p.account.id, p.suggestion), d))
  return (
    <FireSectionCard
      eyebrow="Detected from your trades"
      info="Worked out from your linked brokerage's trade history (up to 24 months): how much it sells each year compared with its balance, and how long positions were held before selling (oldest shares sold first). Positions bought before that history are left out of the holding period."
      right={
        pending.length > 1 ? (
          <button type="button" onClick={applyAll} className="btn-secondary text-xs">
            Apply all
          </button>
        ) : undefined
      }
    >
      <ul className="space-y-3">
        {pending.map((p) => (
          <li key={p.account.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{p.account.name} looks actively traded</p>
              <p className="text-xs text-foreground-muted">{evidence(p.activity)}</p>
              <p className="text-xs text-foreground mt-0.5">{change(p)}</p>
            </div>
            <button
              type="button"
              onClick={() => update((d) => applyTradingSuggestion(d, p.account.id, p.suggestion))}
              className="btn-primary text-xs"
            >
              Apply
            </button>
          </li>
        ))}
      </ul>
    </FireSectionCard>
  )
}

"use client"

import { SubscriptionTableRow, type SubscriptionRowHandlers } from "@/components/finance/subscription-table-row"
import { FREQUENCY_LABELS } from "@/components/finance/subscription-display"
import type { SubscriptionItem } from "@/hooks/finance/use-subscriptions"

const FREQUENCY_ORDER = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"] as const

interface SubscriptionTableViewProps extends SubscriptionRowHandlers {
  items: SubscriptionItem[]
  /** When grouping by frequency, a map of frequency → rows (else null for a flat list). */
  groups?: Record<string, SubscriptionItem[]> | null
}

export function SubscriptionTableView({ items, groups, ...handlers }: SubscriptionTableViewProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
            <th className="py-2 pl-3 pr-2 font-medium">Subscription</th>
            <th className="py-2 px-2 font-medium text-right">Amount</th>
            <th className="py-2 px-2 font-medium">Frequency</th>
            <th className="py-2 px-2 font-medium">Next charge</th>
            <th className="py-2 px-2 font-medium">Status</th>
            <th className="py-2 pr-3 pl-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups
            ? FREQUENCY_ORDER.flatMap((freq) => {
                const rows = groups[freq]
                if (!rows || rows.length === 0) return []
                return [
                  <tr key={`h-${freq}`} className="bg-background-secondary/50">
                    <td colSpan={6} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                      {FREQUENCY_LABELS[freq] ?? freq}
                    </td>
                  </tr>,
                  ...rows.map((sub) => (
                    <SubscriptionTableRow key={sub.id} sub={sub} {...handlers} />
                  )),
                ]
              })
            : items.map((sub) => (
                <SubscriptionTableRow key={sub.id} sub={sub} {...handlers} />
              ))}
        </tbody>
      </table>
    </div>
  )
}

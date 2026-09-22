"use client"

import { SubscriptionCard } from "@/components/finance/subscription-card"
import { FREQUENCY_LABELS } from "@/components/finance/subscription-display"
import type { SubscriptionItem } from "@/hooks/finance/use-subscriptions"

const FREQUENCY_ORDER = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"] as const

export interface SubscriptionCardHandlers {
  onUpdateStatus?: (id: string, status: string) => void
  onToggleWanted?: (id: string, isWanted: boolean) => void
  onRequestCancel?: (sub: { id: string; merchantName: string; amount: number; frequency: string }) => void
  onUpdateNickname?: (id: string, nickname: string | null) => void
  onUpdateFrequency?: (id: string, frequency: string) => void
  onUpdateCategory?: (id: string, category: string | null) => void
  onSetReminder?: (id: string, date: string | null) => void
  onDismiss?: (id: string) => void
}

interface SubscriptionCardGridProps extends SubscriptionCardHandlers {
  items: SubscriptionItem[]
  groups?: Record<string, SubscriptionItem[]> | null
}

function card(sub: SubscriptionItem, handlers: SubscriptionCardHandlers) {
  return (
    <SubscriptionCard
      key={sub.id}
      id={sub.id}
      merchantName={sub.merchantName}
      nickname={sub.nickname}
      amount={sub.amount}
      frequency={sub.frequency}
      status={sub.status}
      isWanted={sub.isWanted}
      nextChargeDate={sub.nextChargeDate}
      category={sub.category}
      logoUrl={sub.logoUrl}
      detectionMethod={sub.detectionMethod}
      averageAmount={sub.averageAmount}
      accountName={sub.accountName}
      accountMask={sub.accountMask}
      accountType={sub.accountType}
      institutionName={sub.institutionName}
      recentTransactions={sub.recentTransactions}
      linkedTransaction={sub.linkedTransaction}
      cancelReminderDate={sub.cancelReminderDate}
      {...handlers}
    />
  )
}

export function SubscriptionCardGrid({ items, groups, ...handlers }: SubscriptionCardGridProps) {
  if (groups) {
    return (
      <div className="space-y-4">
        {FREQUENCY_ORDER.map((freq) => {
          const rows = groups[freq]
          if (!rows || rows.length === 0) return null
          return (
            <div key={freq}>
              <h4 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                {FREQUENCY_LABELS[freq] ?? freq}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((sub) => card(sub, handlers))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((sub) => card(sub, handlers))}
    </div>
  )
}

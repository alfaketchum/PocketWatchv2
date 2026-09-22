"use client"

import { useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { getBillingUrgency } from "@/components/finance/subscription-card-helpers"
import { SubscriptionLinkedProof } from "@/components/finance/subscription-linked-proof"
import type { SubscriptionItem } from "@/hooks/finance/use-subscriptions"
import {
  FREQUENCY_LABELS,
  FREQUENCY_COLORS,
  DETECTION_LABELS,
  STATUS_STYLES,
} from "@/components/finance/subscription-display"

export interface SubscriptionRowHandlers {
  onUpdateStatus?: (id: string, status: string) => void
  onRequestCancel?: (sub: { id: string; merchantName: string; amount: number; frequency: string }) => void
  onSetReminder?: (id: string, date: string | null) => void
  onDismiss?: (id: string) => void
}

const COL_SPAN = 6

export function SubscriptionTableRow({
  sub,
  onUpdateStatus,
  onRequestCancel,
  onSetReminder,
  onDismiss,
}: { sub: SubscriptionItem } & SubscriptionRowHandlers) {
  const [expanded, setExpanded] = useState(false)
  const displayName = sub.nickname || sub.merchantName
  const urgency = sub.nextChargeDate ? getBillingUrgency(sub.nextChargeDate, sub.frequency) : null
  const detection = sub.detectionMethod ? DETECTION_LABELS[sub.detectionMethod] : null
  const hasReminder = !!sub.cancelReminderDate
  const canExpand = (sub.recentTransactions?.length ?? 0) > 0 || !!sub.linkedTransaction

  return (
    <>
      <tr className="border-t border-card-border/60 hover:bg-background-secondary/40 transition-colors">
        {/* Merchant */}
        <td className="py-2.5 pl-3 pr-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => canExpand && setExpanded(!expanded)}
              className={cn(
                "flex-shrink-0 text-foreground-muted transition-transform",
                canExpand ? "hover:text-foreground" : "opacity-0 pointer-events-none",
              )}
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
              title={expanded ? "Hide charges" : "Show charges"}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>expand_more</span>
            </button>
            <MerchantIcon logoUrl={sub.logoUrl} category={sub.category} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              {sub.nickname && (
                <p className="text-[10px] text-foreground-muted truncate">{sub.merchantName}</p>
              )}
              {detection && (
                <span className={cn("text-[10px]", detection.color)}>{detection.text}</span>
              )}
            </div>
          </div>
        </td>

        {/* Amount */}
        <td className="py-2.5 px-2 text-right whitespace-nowrap">
          <span className="font-data text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(sub.amount)}
          </span>
          {sub.averageAmount != null && Math.abs(sub.averageAmount - sub.amount) > 0.01 && (
            <p className="text-[10px] text-foreground-muted tabular-nums">avg {formatCurrency(sub.averageAmount)}</p>
          )}
        </td>

        {/* Frequency */}
        <td className="py-2.5 px-2">
          <span className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
            FREQUENCY_COLORS[sub.frequency] ?? "bg-background-secondary text-foreground-muted",
          )}>
            {FREQUENCY_LABELS[sub.frequency] ?? sub.frequency}
          </span>
        </td>

        {/* Next charge */}
        <td className="py-2.5 px-2 whitespace-nowrap">
          {urgency ? (
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
              urgency.colorClass,
            )}>
              <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
                {urgency.daysUntil <= 3 ? "priority_high" : "event"}
              </span>
              {urgency.label}
            </span>
          ) : (
            <span className="text-[11px] text-foreground-muted">—</span>
          )}
        </td>

        {/* Status */}
        <td className="py-2.5 px-2">
          <span className={cn("badge text-xs", STATUS_STYLES[sub.status] ?? "badge-neutral")}>
            {sub.status}
          </span>
        </td>

        {/* Actions */}
        <td className="py-2.5 pr-3 pl-2">
          <RowActions
            sub={sub}
            hasReminder={hasReminder}
            onUpdateStatus={onUpdateStatus}
            onRequestCancel={onRequestCancel}
            onSetReminder={onSetReminder}
            onDismiss={onDismiss}
          />
        </td>
      </tr>

      {expanded && canExpand && (
        <tr className="bg-background-secondary/30">
          <td colSpan={COL_SPAN} className="px-4 pb-3 pt-1 space-y-2">
            {sub.linkedTransaction && <SubscriptionLinkedProof transaction={sub.linkedTransaction} />}
            {(sub.recentTransactions?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
                  Charges ({sub.recentTransactions.length})
                </p>
                {sub.recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md bg-background-secondary/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-foreground-muted tabular-nums flex-shrink-0">
                        {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-[10px] text-foreground truncate">{tx.name}</span>
                    </div>
                    <span className="text-[10px] font-medium text-foreground tabular-nums flex-shrink-0 ml-2">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function RowActions({
  sub, hasReminder, onUpdateStatus, onRequestCancel, onSetReminder, onDismiss,
}: { sub: SubscriptionItem; hasReminder: boolean } & SubscriptionRowHandlers) {
  const { id, merchantName, amount, frequency, status } = sub
  const btn = "px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap"

  return (
    <div className="flex items-center justify-end gap-1">
      {status === "suggested" && (
        <button onClick={() => onUpdateStatus?.(id, "active")}
          className={cn(btn, "text-white bg-primary hover:bg-primary-hover")}>
          Confirm
        </button>
      )}

      {status === "dismissed" && (
        <button onClick={() => onUpdateStatus?.(id, "active")}
          className={cn(btn, "text-foreground-muted hover:text-primary hover:bg-primary/10")}>
          Restore
        </button>
      )}

      {status === "cancelled" && (
        <button onClick={() => onUpdateStatus?.(id, "active")}
          className={cn(btn, "text-foreground-muted hover:text-primary hover:bg-primary/10")}>
          Reactivate
        </button>
      )}

      {(status === "active" || status === "paused" || status === "flagged") && (
        <>
          <button
            onClick={() => onRequestCancel
              ? onRequestCancel({ id, merchantName, amount, frequency })
              : onUpdateStatus?.(id, "cancelled")}
            className={cn(btn, "text-foreground-muted hover:text-primary hover:bg-primary/10")}
            title="How to cancel this — links & steps">
            Cancel…
          </button>
          <button
            onClick={() => onUpdateStatus?.(id, "cancelled")}
            className={cn(btn, "text-foreground-muted hover:text-error hover:bg-error/10")}
            title="Already cancelled elsewhere — file it under Inactive">
            Mark cancelled
          </button>
          {!hasReminder && (
            <button
              onClick={() => {
                const reminder = new Date()
                reminder.setDate(reminder.getDate() + 3)
                onSetReminder?.(id, reminder.toISOString())
              }}
              className={cn(btn, "text-foreground-muted hover:text-warning hover:bg-warning/10")}
              title="Remind me in 3 days">
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>alarm_add</span>
            </button>
          )}
        </>
      )}

      {status !== "cancelled" && status !== "dismissed" && (
        <button
          onClick={() => onDismiss?.(id)}
          className={cn(btn, "flex items-center gap-1 border border-card-border/50 text-foreground-muted hover:text-error hover:bg-error/10 hover:border-error/20")}
          title="Not a subscription — dismiss it">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>block</span>
          Not a sub
        </button>
      )}
    </div>
  )
}

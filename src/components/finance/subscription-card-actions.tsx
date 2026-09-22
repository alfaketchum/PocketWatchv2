"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getCancelUrl } from "@/lib/finance/cancel-links"

const STATUS_STYLES: Record<string, string> = {
  active: "badge-success",
  paused: "badge-warning",
  cancelled: "badge-error",
  flagged: "badge-warning",
  dismissed: "badge-neutral",
}

interface SubscriptionCardActionsProps {
  id: string
  merchantName: string
  status: string
  amount: number
  frequency: string
  cancelReminderDate?: string | null
  onUpdateStatus?: (id: string, status: string) => void
  onRequestCancel?: (sub: { id: string; merchantName: string; amount: number; frequency: string }) => void
  onSetReminder?: (id: string, date: string | null) => void
  onDismiss?: (id: string) => void
}

export function SubscriptionCardActions({
  id, merchantName, status, amount, frequency, cancelReminderDate,
  onUpdateStatus, onRequestCancel, onSetReminder, onDismiss,
}: SubscriptionCardActionsProps) {
  const [showDismissConfirm, setShowDismissConfirm] = useState(false)
  const confirmRef = useRef<HTMLDivElement>(null)
  const cancelInfo = getCancelUrl(merchantName)

  useEffect(() => {
    if (!showDismissConfirm) return
    function handleClickOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setShowDismissConfirm(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showDismissConfirm])

  function handleDismissConfirm() {
    setShowDismissConfirm(false)
    onDismiss?.(id)
    toast.success(`"${merchantName}" dismissed`)
  }

  const hasReminder = !!cancelReminderDate
  const reminderDate = cancelReminderDate ? new Date(cancelReminderDate) : null
  const reminderPast = reminderDate && reminderDate <= new Date()

  return (
    <div className="space-y-2 pt-2 border-t border-card-border/50">
      {/* Reminder banner */}
      {hasReminder && (
        <div className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
          reminderPast
            ? "bg-error/10 text-error"
            : "bg-warning/10 text-warning",
        )}>
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            {reminderPast ? "notifications_active" : "alarm"}
          </span>
          <span className="flex-1">
            {reminderPast
              ? "Time to cancel this subscription!"
              : `Reminder set for ${reminderDate!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            }
          </span>
          <button
            onClick={() => onSetReminder?.(id, null)}
            className="text-foreground-muted hover:text-foreground transition-colors"
            title="Remove reminder"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Status badge */}
        <span className={cn("badge text-xs", STATUS_STYLES[status] ?? "badge-neutral")}>
          {status}
        </span>

        {/* Confirm (suggested → active) */}
        {status === "suggested" && (
          <button
            onClick={() => onUpdateStatus?.(id, "active")}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
          >
            Confirm
          </button>
        )}

        {/* Restore (dismissed → active) */}
        {status === "dismissed" && (
          <button
            onClick={() => onUpdateStatus?.(id, "active")}
            className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            Restore
          </button>
        )}

        {/* Cancel (active or paused) */}
        {(status === "active" || status === "paused") && (
          <>
            <button
              onClick={() => {
                if (onRequestCancel) {
                  onRequestCancel({ id, merchantName, amount, frequency })
                } else {
                  onUpdateStatus?.(id, "cancelled")
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            >
              Cancel
            </button>

            {/* Direct cancel link shortcut */}
            {cancelInfo && (
              <a
                href={cancelInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-primary hover:bg-primary-muted rounded-lg transition-colors"
                title={`Cancel on ${new URL(cancelInfo.url).hostname}`}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 13 }}>open_in_new</span>
                Cancel Now
              </a>
            )}

            {/* Set reminder */}
            {!hasReminder && (
              <button
                onClick={() => {
                  const reminder = new Date()
                  reminder.setDate(reminder.getDate() + 3)
                  onSetReminder?.(id, reminder.toISOString())
                  toast.success("Reminder set for 3 days from now")
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-foreground-muted hover:text-warning hover:bg-warning/10 rounded-lg transition-colors"
                title="Remind me to cancel"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 13 }}>alarm_add</span>
                Remind
              </button>
            )}
          </>
        )}

        {/* Reactivate (cancelled only) */}
        {status === "cancelled" && (
          <button
            onClick={() => onUpdateStatus?.(id, "active")}
            className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            Reactivate
          </button>
        )}

        {/* Not a sub — dismiss with confirmation */}
        {status !== "cancelled" && status !== "dismissed" && (
          <div className="relative ml-auto" ref={confirmRef}>
            <button
              onClick={() => setShowDismissConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg border border-card-border/50 hover:border-error/20 transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>block</span>
              Not a sub
            </button>

            {showDismissConfirm && (
              <div className="absolute top-full right-0 mt-1 z-30 bg-card border border-card-border rounded-lg shadow-lg p-3 min-w-[220px] animate-in fade-in zoom-in-95 duration-150">
                <p className="text-xs text-foreground mb-2">
                  Dismiss <span className="font-semibold">{merchantName}</span> permanently?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDismissConfirm}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-error hover:bg-error/90 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setShowDismissConfirm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded-lg transition-colors"
                  >
                    Keep
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

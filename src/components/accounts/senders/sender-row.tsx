"use client"

import { toast } from "sonner"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { useUnsubscribeSenders, useUpdateSender } from "@/hooks/accounts"
import type { MailSenderRow } from "@/types/mail-senders"
import { dateLabel } from "../accounts-helpers"

interface SenderRowProps {
  sender: MailSenderRow
  selected: boolean
  onSelect: (checked: boolean) => void
}

const METHOD_LABEL = { one_click: "One-click", link: "Opens link", mailto: "Sends email" } as const
const BADGE = "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"

/** One mailing-list sender: volume, recency, and how to leave. */
export function SenderRow({ sender, selected, onSelect }: SenderRowProps) {
  const unsubscribe = useUnsubscribeSenders()
  const update = useUpdateSender()
  const busy = unsubscribe.isPending || update.isPending
  const active = sender.status === "active"

  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : "Something went wrong")

  const markUnsubscribed = (method: "link" | "mailto") =>
    update.mutate({ id: sender.id, status: "unsubscribed", method }, { onError })

  const handleUnsubscribe = () => {
    if (sender.method === "one_click") {
      unsubscribe.mutate([sender.id], {
        onSuccess: ({ results }) => {
          const r = results[0]
          if (r?.ok) toast.success(`Unsubscribed from ${sender.displayName}`)
          else toast.error(r?.error ?? "Unsubscribe failed")
        },
        onError,
      })
      return
    }
    const target = sender.method === "link" ? sender.unsubscribeUrl : sender.unsubscribeMailto
    if (!target) return
    // Opened synchronously from the click so popup blockers allow it.
    window.open(target, "_blank", "noopener,noreferrer")
    markUnsubscribed(sender.method === "link" ? "link" : "mailto")
    toast.message(
      sender.method === "link"
        ? "Finish unsubscribing in the page that opened"
        : "Send the email that opened to finish unsubscribing",
    )
  }

  const setStatus = (status: "active" | "kept") => update.mutate({ id: sender.id, status }, { onError })

  return (
    <li className="flex items-center gap-3 border-b border-card-border px-4 py-2.5 last:border-b-0 hover:bg-row-hover">
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        disabled={!active || sender.method !== "one_click"}
        aria-label={`Select ${sender.displayName}`}
        className="h-4 w-4 flex-shrink-0 accent-[var(--primary)] disabled:opacity-30"
      />
      <MerchantIcon website={sender.senderDomain} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{sender.displayName}</p>
          {sender.isAccount && (
            <span className={`${BADGE} border-warning text-warning`} title="You have an account with this sender">
              Account
            </span>
          )}
          {sender.stillSending && (
            <span className={`${BADGE} border-error text-error`} title="Mail kept arriving after you unsubscribed">
              Still sending
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-foreground-muted">
          {sender.senderEmail}
          {sender.mailbox && ` → ${sender.mailbox}`}
          {sender.lastError && active && <span className="text-error"> · {sender.lastError}</span>}
        </p>
      </div>
      <div className="hidden w-24 text-right sm:block">
        <p className="font-mono text-sm text-foreground">{sender.messageCount}</p>
        <p className="text-[11px] text-foreground-muted">{dateLabel(sender.lastSeenAt) ?? "—"}</p>
      </div>
      <div className="flex w-40 flex-shrink-0 items-center justify-end gap-1">
        {active ? (
          <>
            <button type="button" onClick={() => setStatus("kept")} disabled={busy} className="btn-ghost text-xs" title="Keep — hide from this list">
              Keep
            </button>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={busy || !sender.method}
              className="btn-secondary text-xs"
              title={sender.method ? METHOD_LABEL[sender.method] : "No unsubscribe option"}
            >
              {unsubscribe.isPending ? "…" : "Unsubscribe"}
            </button>
          </>
        ) : (
          <>
            <span className="text-[11px] text-foreground-muted">
              {sender.status === "kept" ? "Kept" : `Unsubscribed ${dateLabel(sender.unsubscribedAt) ?? ""}`}
            </span>
            <button type="button" onClick={() => setStatus("active")} disabled={busy} className="btn-ghost text-xs">
              Undo
            </button>
          </>
        )}
      </div>
    </li>
  )
}

"use client"

import { toast } from "sonner"
import { useDeleteAccount, useUpdateAccount } from "@/hooks/accounts"
import { formatCurrency } from "@/lib/utils"
import type { DirectoryEmail, DirectoryService } from "@/types/accounts-directory"
import { SIGNAL_LABELS } from "./accounts-constants"
import { SOURCE_LABELS, dateLabel, paidWithLabel, recurringLabel } from "./accounts-helpers"

interface AccountRowDetailsProps {
  service: DirectoryService
  onEdit: (email: DirectoryEmail) => void
}

const CHIP = "rounded-full border border-card-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground-muted"

/** Expanded row: every email with its evidence, how the card was matched, and actions. */
export function AccountRowDetails({ service, onEdit }: AccountRowDetailsProps) {
  const update = useUpdateAccount()
  const remove = useDeleteAccount()
  const busy = update.isPending || remove.isPending
  const { finance } = service

  const toggleDismiss = (email: DirectoryEmail) => {
    const next = service.status === "active" ? "dismissed" : "active"
    update.mutate(
      { id: email.id, status: next },
      {
        onSuccess: () => toast.success(next === "dismissed" ? "Dismissed" : "Restored"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
      },
    )
  }

  const handleDelete = (email: DirectoryEmail) => {
    remove.mutate(email.id, {
      onSuccess: () => toast.success("Removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    })
  }

  return (
    <div className="space-y-3 bg-background-secondary px-4 py-3 text-xs">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-foreground-muted">
        {finance.paidWith.map((p) => (
          <span key={p.accountId}>
            <span className="text-foreground">{paidWithLabel(p)}</span> · {p.institution} · {SOURCE_LABELS[p.source]}
          </span>
        ))}
        {finance.recurring && (
          <span>
            Recurring <span className="text-foreground">{recurringLabel(finance.recurring)}</span> as “{finance.recurring.merchantName}”
            {finance.recurring.nextChargeDate && ` · next ${dateLabel(finance.recurring.nextChargeDate)}`}
          </span>
        )}
        {finance.spend12m > 0 && (
          <span>
            Spent <span className="text-foreground">{formatCurrency(finance.spend12m)}</span> in the last 12 months
          </span>
        )}
        {service.domains.length > 1 && <span>Also emails from {service.domains.slice(1).join(", ")}</span>}
      </div>

      <ul className="divide-y divide-card-border rounded-lg border border-card-border bg-card">
        {service.emails.map((email) => (
          <li key={email.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">{email.email}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {email.signalTypes.map((s) => (
                  <span key={s} className={CHIP}>
                    {SIGNAL_LABELS[s] ?? s}
                  </span>
                ))}
                {email.paymentLast4 && (
                  <span className={CHIP}>
                    {email.paymentBrand ?? "card"} ••{email.paymentLast4}
                  </span>
                )}
                {email.firstSeenAt && <span className="text-foreground-muted">since {dateLabel(email.firstSeenAt)}</span>}
              </div>
              {email.evidence?.subject && (
                <p className="truncate text-foreground-muted" title={email.evidence.from}>
                  “{email.evidence.subject}”
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <IconButton icon="edit" label="Edit" onClick={() => onEdit(email)} disabled={busy} />
              <IconButton
                icon={service.status === "active" ? "visibility_off" : "restore"}
                label={service.status === "active" ? "Dismiss" : "Restore"}
                onClick={() => toggleDismiss(email)}
                disabled={busy}
              />
              <IconButton icon="delete" label="Remove" onClick={() => handleDelete(email)} disabled={busy} danger />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface IconButtonProps {
  icon: string
  label: string
  onClick: () => void
  disabled: boolean
  danger?: boolean
}

function IconButton({ icon, label, onClick, disabled, danger }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted disabled:opacity-50 ${danger ? "hover:text-error" : "hover:text-foreground"} hover:bg-background-secondary`}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}

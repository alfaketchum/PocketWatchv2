"use client"

import { toast } from "sonner"
import { useUpdateAccount, useDeleteAccount, type DiscoveredAccount } from "@/hooks/accounts"
import { SIGNAL_LABELS } from "./accounts-constants"

interface AccountRowProps {
  account: DiscoveredAccount
}

function lastSeenLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/** One discovered login: the email it was signed up with + evidence + curation. */
export function AccountRow({ account }: AccountRowProps) {
  const update = useUpdateAccount()
  const remove = useDeleteAccount()
  const busy = update.isPending || remove.isPending

  const toggleDismiss = () => {
    const next = account.status === "active" ? "dismissed" : "active"
    update.mutate(
      { id: account.id, status: next },
      {
        onSuccess: () => toast.success(next === "dismissed" ? "Dismissed" : "Restored"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
      },
    )
  }

  const handleDelete = () => {
    remove.mutate(account.id, {
      onSuccess: () => toast.success("Removed"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    })
  }

  const seen = lastSeenLabel(account.lastSeenAt)

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{account.accountEmail}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {account.signalTypes.map((s) => (
            <span
              key={s}
              className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground-muted"
              style={{ borderColor: "var(--card-border)" }}
            >
              {SIGNAL_LABELS[s] ?? s}
            </span>
          ))}
          {seen && <span className="text-[11px] text-foreground-muted">seen {seen}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleDismiss}
        disabled={busy}
        aria-label={account.status === "active" ? "Dismiss" : "Restore"}
        title={account.status === "active" ? "Dismiss" : "Restore"}
        className="inline-flex items-center text-foreground-muted hover:text-foreground disabled:opacity-50"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
          {account.status === "active" ? "visibility_off" : "restore"}
        </span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        aria-label="Remove"
        title="Remove"
        className="inline-flex items-center text-foreground-muted hover:text-error disabled:opacity-50"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
          delete
        </span>
      </button>
    </div>
  )
}

"use client"

import { MerchantIcon } from "@/components/finance/merchant-icon"
import { useMissingEmailServices } from "@/hooks/accounts"
import type { MissingEmailService } from "@/types/accounts-directory"
import { paidWithLabel, recurringLabel } from "./accounts-helpers"

interface AccountsMissingEmailProps {
  onAdd: (service: MissingEmailService) => void
  /** True while charges are being matched to inboxes. */
  linking: boolean
}

/** Recurring charges with no matching service: "you pay for this — which email is it on?" */
export function AccountsMissingEmail({ onAdd, linking }: AccountsMissingEmailProps) {
  const { data, isLoading } = useMissingEmailServices()
  const services = data?.services ?? []

  if (isLoading) return <div className="card h-24 animate-pulse" aria-hidden="true" />
  if (services.length === 0) return null

  return (
    <section className="card overflow-hidden p-0" aria-labelledby="missing-email-title">
      <div className="border-b border-card-border px-4 py-3">
        <h2 id="missing-email-title" className="text-sm font-semibold text-foreground">
          Paying, but no email found
        </h2>
        <p className="mt-0.5 text-xs text-foreground-muted">
          {linking
            ? "Checking which of your inboxes each of these is on…"
            : "Recurring charges we couldn't place in any connected inbox. Add the email you use so everything is in one place."}
        </p>
      </div>
      <ul>
        {services.map((s) => (
          <li key={`${s.merchantName}:${s.amount}`} className="flex items-center gap-3 border-b border-card-border px-4 py-2.5 last:border-b-0">
            <MerchantIcon website={s.domain} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{s.merchantName}</p>
              <p className="truncate text-[11px] text-foreground-muted">
                <span className="font-mono">{recurringLabel(s)}</span>
                {s.paidWith && ` · ${paidWithLabel(s.paidWith)}`}
                {s.notInInbox && " · not in your connected inboxes"}
              </p>
            </div>
            <button type="button" onClick={() => onAdd(s)} className="btn-secondary text-xs">
              Add email
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

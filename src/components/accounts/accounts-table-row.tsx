"use client"

import { MerchantIcon } from "@/components/finance/merchant-icon"
import type { DirectoryEmail, DirectoryService } from "@/types/accounts-directory"
import { categoryLabel } from "./accounts-constants"
import { dateLabel, lastActivityIso, paidWithLabel, recurringLabel } from "./accounts-helpers"
import { AccountRowDetails } from "./account-row-details"

export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_2rem] md:items-center md:gap-3"

interface AccountsTableRowProps {
  service: DirectoryService
  expanded: boolean
  onToggle: () => void
  onEdit: (email: DirectoryEmail) => void
}

/** One service: who it is, which email(s), which card pays, what it costs. */
export function AccountsTableRow({ service, expanded, onToggle, onEdit }: AccountsTableRowProps) {
  const { finance } = service
  const emails = [...new Set(service.emails.map((e) => e.email))]
  const lastActivity = dateLabel(lastActivityIso(service))
  const cat = categoryLabel(service.category)

  return (
    <li className="border-b border-card-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full px-4 py-3 text-left transition-colors hover:bg-row-hover ${ROW_GRID} flex flex-col gap-1.5`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MerchantIcon website={service.domain} category={service.category} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
            <p className="truncate text-[11px] text-foreground-muted">
              {service.domain}
              {cat && ` · ${cat}`}
              {finance.institution && " · your institution"}
            </p>
          </div>
        </div>

        <div className="min-w-0 pl-10 md:pl-0">
          {emails.map((e) => (
            <p key={e} className="truncate text-xs text-foreground">
              {e}
            </p>
          ))}
        </div>

        <div className="min-w-0 pl-10 md:pl-0">
          {finance.paidWith.length === 0 ? (
            <span className="text-xs text-foreground-muted">—</span>
          ) : (
            finance.paidWith.slice(0, 2).map((p) => (
              <span
                key={p.accountId}
                className="mr-1 inline-flex max-w-full items-center gap-1 rounded-md bg-seg-on-bg px-1.5 py-0.5 text-[11px] font-medium text-primary"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 13 }} aria-hidden="true">
                  credit_card
                </span>
                <span className="truncate">{paidWithLabel(p)}</span>
              </span>
            ))
          )}
        </div>

        <div className="pl-10 text-xs md:pl-0">
          {finance.recurring ? (
            <span className="font-mono text-foreground">{recurringLabel(finance.recurring)}</span>
          ) : (
            <span className="text-foreground-muted">—</span>
          )}
        </div>

        <div className="hidden text-xs text-foreground-muted md:block">{lastActivity ?? "—"}</div>

        <span
          className={`material-symbols-rounded hidden text-foreground-muted transition-transform md:block ${expanded ? "rotate-180" : ""}`}
          style={{ fontSize: 18 }}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {expanded && <AccountRowDetails service={service} onEdit={onEdit} />}
    </li>
  )
}

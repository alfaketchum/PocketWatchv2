"use client"

import type { DiscoveredAccount } from "@/hooks/accounts"
import { AccountRow } from "./account-row"
import { categoryLabel } from "./accounts-constants"

interface AccountGroupProps {
  serviceName: string
  serviceDomain: string
  category: string | null
  accounts: DiscoveredAccount[]
}

/** One service card: brand header + the email(s) used to sign up for it. */
export function AccountGroup({ serviceName, serviceDomain, category, accounts }: AccountGroupProps) {
  const monogram = (serviceName || serviceDomain).charAt(0).toUpperCase()
  const cat = categoryLabel(category)

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-foreground"
          style={{ backgroundColor: "var(--background-secondary)" }}
          aria-hidden="true"
        >
          {monogram}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{serviceName}</p>
          <p className="truncate text-xs text-foreground-muted">{serviceDomain}</p>
        </div>
        {cat && (
          <span
            className="rounded-full border px-2 py-0.5 text-[11px] text-foreground-muted"
            style={{ borderColor: "var(--card-border)" }}
          >
            {cat}
          </span>
        )}
      </div>

      <div className="mt-2 divide-y" style={{ borderColor: "var(--card-border)" }}>
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} />
        ))}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useAccounts, type AccountFilters, type DiscoveredAccount } from "@/hooks/accounts"
import { EmptyState } from "@/components/ui/empty-state"
import { AccountsSearchBar } from "./accounts-search-bar"
import { AccountGroup } from "./account-group"
import { AccountsSkeleton } from "./accounts-skeleton"

interface AccountsDirectoryProps {
  hasGmail: boolean
  onScan: () => void
  isScanning: boolean
}

interface ServiceGroup {
  serviceDomain: string
  serviceName: string
  category: string | null
  accounts: DiscoveredAccount[]
}

function groupByService(accounts: DiscoveredAccount[]): ServiceGroup[] {
  const map = new Map<string, ServiceGroup>()
  for (const account of accounts) {
    const existing = map.get(account.serviceDomain)
    if (existing) {
      existing.accounts.push(account)
      if (!existing.category && account.category) existing.category = account.category
    } else {
      map.set(account.serviceDomain, {
        serviceDomain: account.serviceDomain,
        serviceName: account.serviceName,
        category: account.category,
        accounts: [account],
      })
    }
  }
  return [...map.values()]
}

export function AccountsDirectory({ hasGmail, onScan, isScanning }: AccountsDirectoryProps) {
  const [filters, setFilters] = useState<AccountFilters>({ status: "active" })
  const [debounced, setDebounced] = useState<AccountFilters>(filters)

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 300)
    return () => clearTimeout(t)
  }, [filters])

  const { data, isLoading, isError } = useAccounts(debounced)
  const groups = useMemo(() => groupByService(data?.accounts ?? []), [data])

  const isFiltered = Boolean(filters.service || filters.category) || filters.status === "dismissed"

  return (
    <div className="space-y-4">
      <AccountsSearchBar filters={filters} onChange={setFilters} />

      {isLoading && <AccountsSkeleton />}

      {isError && !isLoading && (
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "var(--error)" }}>
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load accounts</p>
          <p className="mt-1 text-xs text-foreground-muted">Please refresh and try again.</p>
        </div>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        isFiltered ? (
          <EmptyState
            icon="filter_alt"
            title="No matches"
            description="No discovered accounts match your filters. Try clearing the search or category."
          />
        ) : hasGmail ? (
          <EmptyState
            icon="alternate_email"
            title="No logins discovered yet"
            description="Scan your connected Gmail to build a directory of the services you've signed up for and the email you used for each."
            action={{ label: isScanning ? "Scanning…" : "Scan Gmail", onClick: onScan }}
          />
        ) : (
          <EmptyState
            icon="mail"
            title="Connect your email"
            description="Connect Gmail to automatically discover which services you've signed up for and which email address you used for each."
            action={{ label: "Connect Gmail", href: "/api/integrations/gmail/connect" }}
          />
        )
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <AccountGroup
              key={g.serviceDomain}
              serviceName={g.serviceName}
              serviceDomain={g.serviceDomain}
              category={g.category}
              accounts={g.accounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

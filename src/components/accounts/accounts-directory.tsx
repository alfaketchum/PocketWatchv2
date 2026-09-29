"use client"

import { useEffect, useMemo, useState } from "react"
import { useAccountsDirectory, type DirectoryFilters } from "@/hooks/accounts"
import { EmptyState } from "@/components/ui/empty-state"
import type {
  DirectoryEmail,
  DirectoryService,
  MissingEmailService,
} from "@/types/accounts-directory"
import { AccountsFilterBar } from "./accounts-filter-bar"
import { AccountsTable } from "./accounts-table"
import { AccountsMissingEmail } from "./accounts-missing-email"
import { AccountsSkeleton } from "./accounts-skeleton"
import { AccountEditDialog } from "./account-edit-dialog"
import { AccountAddDialog, type AccountAddDefaults } from "./account-add-dialog"
import { groupDirectory, type DirectoryGroupBy } from "./accounts-helpers"

interface AccountsDirectoryProps {
  hasGmail: boolean
}

const PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 300

interface EditTarget {
  service: DirectoryService
  email: DirectoryEmail
}

/** Accounts page body: filters, the service list, and the "no email found" list. */
export function AccountsDirectory({ hasGmail }: AccountsDirectoryProps) {
  const [filters, setFilters] = useState<DirectoryFilters>({ status: "active", page: 1, limit: PAGE_SIZE })
  const [debounced, setDebounced] = useState<DirectoryFilters>(filters)
  const [groupBy, setGroupBy] = useState<DirectoryGroupBy>("none")
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [adding, setAdding] = useState<AccountAddDefaults | null>(null)

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters])

  const { data, isLoading, isError } = useAccountsDirectory(debounced)
  const services = useMemo(() => data?.services ?? [], [data])
  const sections = useMemo(() => groupDirectory(services, groupBy), [services, groupBy])
  const knownEmails = useMemo(() => data?.facets.emails.map((o) => o.label) ?? [], [data])
  const paymentAccounts = data?.paymentAccounts ?? []

  const page = filters.page ?? 1
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const isFiltered =
    Boolean(filters.q || filters.email || filters.accountId || filters.category) ||
    (filters.link ?? "all") !== "all" ||
    filters.status === "dismissed"

  const handleAddMissing = (s: MissingEmailService) =>
    setAdding({
      serviceName: s.merchantName,
      serviceDomain: s.domain ?? "",
      paymentAccountId: s.paidWith?.accountId ?? null,
    })

  return (
    <div className="space-y-4">
      <AccountsFilterBar
        filters={filters}
        onChange={setFilters}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        facets={data?.facets}
      />

      {isLoading && <AccountsSkeleton />}

      {isError && !isLoading && (
        <div className="card border-l-4 p-4" style={{ borderLeftColor: "var(--error)" }}>
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load accounts</p>
          <p className="mt-1 text-xs text-foreground-muted">Please refresh and try again.</p>
        </div>
      )}

      {!isLoading && !isError && services.length === 0 && (
        isFiltered ? (
          <EmptyState
            icon="filter_alt"
            title="No matches"
            description="No services match your filters. Try clearing the search, email or card filter."
          />
        ) : hasGmail ? (
          <EmptyState
            icon="alternate_email"
            title="No logins discovered yet"
            description="Click Scan Gmail above to build a directory of the services you've signed up for and the email you used for each."
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

      {!isLoading && !isError && services.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span>
              {data?.total} service{data?.total === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={() => setAdding({})} className="btn-ghost text-xs">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
                add
              </span>
              Add manually
            </button>
          </div>
          <AccountsTable sections={sections} onEdit={(service, email) => setEditing({ service, email })} />
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs text-foreground-muted">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setFilters({ ...filters, page: page - 1 })}>
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button type="button" className="btn-ghost" disabled={page >= pageCount} onClick={() => setFilters({ ...filters, page: page + 1 })}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      {filters.status !== "dismissed" && <AccountsMissingEmail onAdd={handleAddMissing} />}

      {editing && (
        <AccountEditDialog
          service={editing.service}
          email={editing.email}
          paymentAccounts={paymentAccounts}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <AccountAddDialog
          defaults={adding}
          knownEmails={knownEmails}
          paymentAccounts={paymentAccounts}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}

"use client"

import { ChartViewToggle } from "@/components/ui/chart-view-toggle"
import type { AccountStatus, DirectoryFilters } from "@/hooks/accounts"
import type { DirectoryFacets } from "@/types/accounts-directory"
import { categoryLabel } from "./accounts-constants"
import { GROUP_BY_VIEWS, LINK_VIEWS, type DirectoryGroupBy } from "./accounts-helpers"

interface AccountsFilterBarProps {
  filters: DirectoryFilters
  onChange: (next: DirectoryFilters) => void
  groupBy: DirectoryGroupBy
  onGroupByChange: (next: DirectoryGroupBy) => void
  facets: DirectoryFacets | undefined
}

const SELECT = "rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"

/** Search + email / card / category / status filters, sort, link toggle and group-by. */
export function AccountsFilterBar({ filters, onChange, groupBy, onGroupByChange, facets }: AccountsFilterBarProps) {
  const set = (patch: Partial<DirectoryFilters>) => onChange({ ...filters, ...patch, page: 1 })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span
            className="material-symbols-rounded pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted"
            style={{ fontSize: 18 }}
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search services…"
            className="w-full rounded-lg border border-card-border bg-card py-2 pl-9 pr-3 text-sm text-foreground"
            aria-label="Search services"
          />
        </div>

        <select value={filters.email ?? ""} onChange={(e) => set({ email: e.target.value || undefined })} className={SELECT} aria-label="Filter by email">
          <option value="">All emails</option>
          {facets?.emails.map((o) => (
            <option key={o.value} value={o.label}>
              {o.label} ({o.count})
            </option>
          ))}
        </select>

        <select value={filters.accountId ?? ""} onChange={(e) => set({ accountId: e.target.value || undefined })} className={SELECT} aria-label="Filter by card">
          <option value="">All cards</option>
          {facets?.cards.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({o.count})
            </option>
          ))}
        </select>

        <select value={filters.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })} className={SELECT} aria-label="Filter by category">
          <option value="">All categories</option>
          {facets?.categories.map((o) => (
            <option key={o.value} value={o.value}>
              {categoryLabel(o.value)} ({o.count})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChartViewToggle views={GROUP_BY_VIEWS} view={groupBy} onChange={onGroupByChange} />
        <ChartViewToggle views={LINK_VIEWS} view={filters.link ?? "all"} onChange={(link) => set({ link })} />
        <div className="ml-auto flex items-center gap-2">
          <select value={filters.sort ?? "name"} onChange={(e) => set({ sort: e.target.value as DirectoryFilters["sort"] })} className={SELECT} aria-label="Sort">
            <option value="name">Name</option>
            <option value="spend">Most spent</option>
            <option value="recent">Recent activity</option>
          </select>
          <select value={filters.status ?? "active"} onChange={(e) => set({ status: e.target.value as AccountStatus })} className={SELECT} aria-label="Filter by status">
            <option value="active">Active</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>
    </div>
  )
}

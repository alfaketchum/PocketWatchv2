"use client"

import type { AccountFilters, AccountStatus } from "@/hooks/accounts"
import { CATEGORY_OPTIONS, categoryLabel } from "./accounts-constants"

interface AccountsSearchBarProps {
  filters: AccountFilters
  onChange: (next: AccountFilters) => void
}

/** Controlled search + category + status filter row for the directory. */
export function AccountsSearchBar({ filters, onChange }: AccountsSearchBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <span
          className="material-symbols-rounded absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
          style={{ fontSize: 18 }}
          aria-hidden="true"
        >
          search
        </span>
        <input
          type="search"
          value={filters.service ?? ""}
          onChange={(e) => onChange({ ...filters, service: e.target.value || undefined })}
          placeholder="Search service or email domain…"
          className="w-full rounded-lg border bg-card pl-9 pr-3 py-2 text-sm text-foreground"
          style={{ borderColor: "var(--card-border)" }}
          aria-label="Search accounts"
        />
      </div>

      <select
        value={filters.category ?? ""}
        onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
        className="rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
        style={{ borderColor: "var(--card-border)" }}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </select>

      <select
        value={filters.status ?? "active"}
        onChange={(e) => onChange({ ...filters, status: e.target.value as AccountStatus })}
        className="rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
        style={{ borderColor: "var(--card-border)" }}
        aria-label="Filter by status"
      >
        <option value="active">Active</option>
        <option value="dismissed">Dismissed</option>
      </select>
    </div>
  )
}

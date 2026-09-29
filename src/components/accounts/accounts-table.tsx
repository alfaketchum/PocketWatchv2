"use client"

import { useState } from "react"
import type { DirectoryEmail, DirectoryService } from "@/types/accounts-directory"
import type { DirectorySection } from "./accounts-helpers"
import { AccountsTableRow, ROW_GRID } from "./accounts-table-row"

interface AccountsTableProps {
  sections: DirectorySection[]
  onEdit: (service: DirectoryService, email: DirectoryEmail) => void
}

const HEADERS = ["Service", "Signed up with", "Paid with", "Recurring", "Last activity", ""]

/** Directory list: a column header, then one row per service (optionally sectioned). */
export function AccountsTable({ sections, onEdit }: AccountsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="card overflow-hidden p-0">
      <div className={`hidden border-b border-card-border px-4 py-2 ${ROW_GRID}`}>
        {HEADERS.map((h, i) => (
          <span key={i} className="text-[11px] font-medium uppercase tracking-wide text-accent-head">
            {h}
          </span>
        ))}
      </div>

      {sections.map((section) => (
        <section key={section.key} aria-label={section.label || "Services"}>
          {section.label && (
            <div className="flex items-center justify-between border-b border-card-border bg-background-secondary px-4 py-2">
              <h3 className="truncate text-xs font-semibold text-foreground">{section.label}</h3>
              <span className="text-[11px] text-foreground-muted">
                {section.services.length} service{section.services.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
          <ul>
            {section.services.map((service) => {
              const rowKey = `${section.key}:${service.domain}`
              return (
                <AccountsTableRow
                  key={rowKey}
                  service={service}
                  expanded={expanded === rowKey}
                  onToggle={() => setExpanded(expanded === rowKey ? null : rowKey)}
                  onEdit={(email) => onEdit(service, email)}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

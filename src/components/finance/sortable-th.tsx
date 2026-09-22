"use client"

import { cn } from "@/lib/utils"

export type SortDir = "asc" | "desc"

interface SortableThProps {
  label: string
  field: string
  activeField: string
  dir: SortDir
  onSort: (field: string) => void
  align?: "left" | "right" | "center"
  /** Padding/width utility classes for the <th>. */
  className?: string
}

/**
 * Clickable column header that toggles sort. Text styling (size, case) is
 * inherited from the parent <tr>/<thead>. Shows an up/down arrow when active,
 * and a neutral unfold icon otherwise to signal it's sortable.
 */
export function SortableTh({ label, field, activeField, dir, onSort, align = "left", className }: SortableThProps) {
  const active = activeField === field
  return (
    <th className={cn(align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left", "font-semibold", className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-0.5 select-none hover:text-foreground transition-colors",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        <span>{label}</span>
        <span
          className={cn("material-symbols-rounded", active ? "opacity-90" : "opacity-40")}
          style={{ fontSize: 13 }}
        >
          {active ? (dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
        </span>
      </button>
    </th>
  )
}

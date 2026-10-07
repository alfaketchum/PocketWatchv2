"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Overrides the unlayered global input styles (see FireNumberField). */
const CELL_STYLE = { padding: "4px 8px", fontSize: 13, border: "1px solid transparent", background: "transparent", boxShadow: "none" } as const
/** On touch screens there is no hover, so the cell border always shows to mark it editable. */
const CELL_CLASS =
  "w-full min-w-0 rounded-md text-foreground outline-none hover:!border-[var(--card-border)] [@media(hover:none)]:!border-[var(--card-border)] focus:!border-[var(--primary)] focus:!bg-[var(--background)]"

function display(value: number, scale: number): string {
  const scaled = value * scale
  return Number.isInteger(scaled) ? String(scaled) : String(Math.round(scaled * 100) / 100)
}

/** Borderless number cell that commits on blur/Enter, like FireNumberField. */
export function CellNumber({
  value,
  onChange,
  scale = 1,
  min,
  max,
  prefix,
  suffix,
  label,
}: {
  value: number
  onChange: (value: number) => void
  scale?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  label: string
}) {
  const [draft, setDraft] = useState(() => display(value, scale))
  useEffect(() => setDraft(display(value, scale)), [value, scale])
  const commit = () => {
    const parsed = Number(draft.replace(/[,$\s%]/g, ""))
    if (!Number.isFinite(parsed)) return setDraft(display(value, scale))
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed / scale))
    if (bounded !== value) onChange(bounded)
    else setDraft(display(value, scale))
  }
  return (
    <span className="flex items-center justify-end gap-0.5 tabular-nums">
      {prefix && <span className="text-xs text-foreground-muted">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(CELL_CLASS, "text-right")}
        style={CELL_STYLE}
      />
      {suffix && <span className="whitespace-nowrap text-xs text-foreground-muted">{suffix}</span>}
    </span>
  )
}

export function CellText({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <input aria-label={label} value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} className={CELL_CLASS} style={CELL_STYLE} />
  )
}

export function CellSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={CELL_CLASS} style={CELL_STYLE}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function CellCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="mobile-checkbox-wrap inline-flex cursor-pointer">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
    </label>
  )
}

export function RowButton({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("btn-ghost h-7 min-w-10 justify-center px-1 text-foreground-muted lg:min-w-0", danger ? "hover:text-error" : "hover:text-foreground")}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
        {icon}
      </span>
    </button>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 rounded bg-background-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">{children}</span>
}

export interface Column {
  label: string
  align?: "left" | "right" | "center"
  /** Tailwind width class for the column. */
  width?: string
  /** Sortable columns: the current direction (null = not sorted by this column) and what a click does. */
  sort?: "asc" | "desc" | null
  onSort?: () => void
}

const SORT_ICONS = { asc: "arrow_upward", desc: "arrow_downward" } as const

/** A column header's label; a button with a direction arrow when the column is sortable. */
function HeaderLabel({ column }: { column: Column }) {
  if (!column.onSort) return <>{column.label}</>
  const label = column.sort === "desc" ? "highest first" : column.sort === "asc" ? "lowest first" : "not sorted"
  return (
    <button
      type="button"
      onClick={column.onSort}
      title={`Sort by ${column.label.toLowerCase()} (${label})`}
      className={cn("inline-flex items-center gap-0.5 uppercase tracking-wider hover:text-foreground", column.sort && "text-primary")}
    >
      {column.label}
      <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
        {column.sort ? SORT_ICONS[column.sort] : "unfold_more"}
      </span>
    </button>
  )
}

/**
 * The first column (the item's name) stays pinned while the rest scrolls sideways on narrow screens. Its cells need
 * an opaque fill, so the header and totals use their translucent tints mixed over the card.
 */
const PINNED_FIRST_COLUMN = cn(
  "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-[1] [&_tr>*:first-child]:shadow-[inset_-1px_0_0_var(--card-border)] sm:[&_tr>*:first-child]:shadow-none",
  "[&_td:first-child]:bg-card [&_tr:hover>td:first-child]:bg-row-hover",
  "[&_thead_th:first-child]:bg-[color-mix(in_srgb,var(--background-secondary)_60%,var(--card))]",
  "[&_tfoot_td:first-child]:bg-[color-mix(in_srgb,var(--background-secondary)_40%,var(--card))]",
)

/**
 * For the results tables (loans, trading, compare): on phones, where they scroll sideways, the row label stays pinned.
 * Wider screens show them whole, row tints included.
 */
export const PIN_FIRST_COLUMN_ON_PHONES =
  "max-sm:[&_tr>*:first-child]:sticky max-sm:[&_tr>*:first-child]:left-0 max-sm:[&_tr>*:first-child]:z-[1] max-sm:[&_tr>*:first-child]:bg-card max-sm:[&_tr>*:first-child]:shadow-[inset_-1px_0_0_var(--card-border)]"

/** Compact table shell: pinned name column, horizontal scroll on narrow screens, optional totals row. */
export function PlanTable({
  columns,
  children,
  footer,
  minWidth = "min-w-[640px]",
}: {
  columns: Column[]
  children: ReactNode
  footer?: ReactNode
  /** Narrowest the table gets before it scrolls sideways (a Tailwind min-w class). */
  minWidth?: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-card-border">
      <table className={cn("w-full text-sm", minWidth, PINNED_FIRST_COLUMN)}>
        <thead className="bg-background-secondary/60">
          <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
            {columns.map((c, i) => (
              <th
                key={`${c.label}-${i}`}
                className={cn("px-2 py-2 font-semibold whitespace-nowrap", c.width, c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
              >
                <HeaderLabel column={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot className="border-t border-card-border bg-background-secondary/40 text-xs font-semibold">{footer}</tfoot>}
      </table>
    </div>
  )
}

export function Row({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <tr className={cn("border-t border-card-border hover:bg-row-hover", muted && "text-foreground-muted")}>{children}</tr>
}

/**
 * A section heading between a table's rows: the group's name (after an optional icon) and line count in the first
 * column, then the caller's subtotal cells.
 */
export function GroupRow({ label, count, leading, children }: { label: string; count: number; leading?: ReactNode; children?: ReactNode }) {
  return (
    <tr className="border-t border-card-border text-xs font-semibold text-foreground-muted">
      <td className="px-2 pb-1.5 pt-3">
        <span className="flex items-center gap-1.5">
          {leading}
          <span className="text-[10px] uppercase tracking-wider text-accent-head">{label}</span>
          <span className="text-[10px] font-medium tabular-nums">{count}</span>
        </span>
      </td>
      {children}
    </tr>
  )
}

/** `omit` drops the cell, for a column the table leaves out (Basic mode). */
export function Cell({
  children,
  align,
  className,
  omit,
}: {
  children?: ReactNode
  align?: "left" | "right" | "center"
  className?: string
  omit?: boolean
}) {
  if (omit) return null
  return (
    <td className={cn("px-1.5 py-1 align-middle", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left", className)}>
      {children}
    </td>
  )
}

export type PlanEditorView = "compact" | "detailed"

const VIEW_KEY = "plan-editor-view"

/** Earlier builds saved "table" / "list". */
const LEGACY_VIEWS: Record<string, PlanEditorView> = { table: "compact", list: "detailed" }

/** Compact (table) or Detailed (cards): Compact until you switch, then remembered in this browser. */
export function usePlanEditorView(): [PlanEditorView, (view: PlanEditorView) => void] {
  const [view, setView] = useState<PlanEditorView>("compact")
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY)
      const resolved = saved === "compact" || saved === "detailed" ? saved : saved ? LEGACY_VIEWS[saved] : undefined
      if (resolved) setView(resolved)
    } catch {
      // Storage can be unavailable (private mode); the default still works.
    }
  }, [])
  const change = (next: PlanEditorView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
  return [view, change]
}

/** Compact / Detailed toggle, styled like the Transactions page's view toggle. */
export function ViewToggle({ value, onChange }: { value: PlanEditorView; onChange: (view: PlanEditorView) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
      {(
        [
          { key: "compact", label: "Compact", icon: "table_rows" },
          { key: "detailed", label: "Detailed", icon: "view_agenda" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          title={`${opt.label} view`}
          aria-pressed={value === opt.key}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors duration-150",
            value === opt.key ? "bg-primary text-white shadow-sm" : "bg-transparent text-foreground-muted hover:text-foreground",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            {opt.icon}
          </span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

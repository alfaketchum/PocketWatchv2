"use client"

import { useEffect, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Overrides the unlayered global input styles (see FireNumberField). */
const CELL_STYLE = { padding: "4px 8px", fontSize: 13, border: "1px solid transparent", background: "transparent", boxShadow: "none" } as const
const CELL_CLASS =
  "w-full min-w-0 rounded-md text-foreground outline-none hover:!border-[var(--card-border)] focus:!border-[var(--primary)] focus:!bg-[var(--background)]"

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
  return <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--primary)]" />
}

export function RowButton({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("btn-ghost h-7 px-1 text-foreground-muted", danger ? "hover:text-error" : "hover:text-foreground")}
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
}

/** Compact table shell: sticky header, horizontal scroll on narrow screens, optional totals row. */
export function PlanTable({ columns, children, footer }: { columns: Column[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-card-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-background-secondary/60">
          <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
            {columns.map((c, i) => (
              <th
                key={`${c.label}-${i}`}
                className={cn("px-2 py-2 font-semibold whitespace-nowrap", c.width, c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
              >
                {c.label}
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

export function Cell({ children, align, className }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
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

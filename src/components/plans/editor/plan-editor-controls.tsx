"use client"

import type { ReactNode } from "react"

/** Overrides the unlayered global input styles (see FireNumberField). */
const FIELD_STYLE = { padding: "6px 10px", fontSize: 14 } as const
const FIELD_CLASS =
  "w-full rounded-lg border border-card-border bg-background text-sm text-foreground outline-none focus:border-primary"

export function TextField({
  label,
  value,
  onChange,
  maxLength = 80,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={FIELD_CLASS} style={FIELD_STYLE}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** A bordered card holding one list item's fields, with a remove button. */
export function ItemCard({
  title,
  onRemove,
  removeLabel,
  anchorId,
  children,
}: {
  title: ReactNode
  onRemove?: () => void
  removeLabel: string
  /** DOM id so the table view can jump here. */
  anchorId?: string
  children: ReactNode
}) {
  return (
    <div id={anchorId} className="rounded-xl border border-card-border p-3 sm:p-4 space-y-3 scroll-mt-24">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground min-w-0 truncate">{title}</div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-ghost h-8 px-2 text-foreground-muted hover:text-error"
            aria-label={removeLabel}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              delete
            </span>
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

export function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
        add
      </span>
      {label}
    </button>
  )
}

/** Top of a list tab: its Add buttons on the left, the Compact / Detailed switch on the right. */
export function EditorToolbar({ children, toggle, center }: { children?: ReactNode; toggle?: ReactNode; center?: ReactNode }) {
  if (center) {
    // Three columns so the middle control sits in the true center, whatever the widths on either side.
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <div className="flex justify-center">{center}</div>
        <div className="flex justify-end">{toggle}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {toggle}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-foreground-muted">{children}</p>
}

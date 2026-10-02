"use client"

import { createContext, useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Inside this, every InputBlock lays out as a settings row: its title on the left, its fields on the right. */
const RowLayout = createContext(false)

export function InputBlockRows({ children }: { children: ReactNode }) {
  return <RowLayout.Provider value>{children}</RowLayout.Provider>
}

/** Anchor id for a block's row, so a page can link to it. */
export const inputBlockAnchor = (title: string) => `block-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

/** A titled block within an editor section: heading + optional one-line description. */
export function InputBlock({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  const row = useContext(RowLayout)
  if (row) {
    return (
      <section id={title ? inputBlockAnchor(title) : undefined} className="grid scroll-mt-4 gap-3 py-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <div>
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          {description && <p className="text-xs text-foreground-muted mt-0.5">{description}</p>}
        </div>
        <div className="min-w-0 max-w-3xl space-y-3">{children}</div>
      </section>
    )
  }
  return (
    <div className="space-y-3">
      {(title || description) && (
        <div>
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          {description && <p className="text-xs text-foreground-muted mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--primary)]" />
      {label}
    </label>
  )
}

/** Pill-style single choice. */
export function ChoiceChips<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

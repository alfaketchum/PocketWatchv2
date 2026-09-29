"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A titled block within an editor section: heading + optional one-line description. */
export function InputBlock({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
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

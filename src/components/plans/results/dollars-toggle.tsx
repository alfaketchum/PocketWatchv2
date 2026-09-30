"use client"

import { cn } from "@/lib/utils"
import type { DollarBasis } from "@/lib/plans/plan-types"

const OPTIONS: { value: DollarBasis; label: string }[] = [
  { value: "today", label: "Today's $" },
  { value: "future", label: "Future $" },
]

/** Show projections in today's dollars (inflation removed) or future (nominal) dollars. */
export function DollarsToggle({ value, onChange }: { value: DollarBasis; onChange: (v: DollarBasis) => void }) {
  return (
    <div role="radiogroup" aria-label="Dollar basis" className="inline-flex rounded-lg border border-card-border p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === o.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

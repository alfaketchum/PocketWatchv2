"use client"

import { InfoTooltip } from "@/components/ui/info-tooltip"
import { cn } from "@/lib/utils"
import type { DollarBasis } from "@/lib/plans/plan-types"

const OPTIONS: { value: DollarBasis; label: string; hint: string }[] = [
  {
    value: "today",
    label: "Today's $",
    hint: "Every amount in today's money. If 2050 shows $100,000, that's what $100,000 buys today. Easiest way to ask: will I live as well then as now?",
  },
  {
    value: "future",
    label: "Future $",
    hint: "The actual price tags of each year, with inflation added. A $5 coffee today shows as about $10 in 25 years (prices rising ~3% a year). Bigger numbers, same buying power: what your statements will say then.",
  },
]

/** Show projections in today's dollars (inflation removed) or future (nominal) dollars. */
export function DollarsToggle({ value, onChange }: { value: DollarBasis; onChange: (v: DollarBasis) => void }) {
  return (
    <div role="radiogroup" aria-label="Dollar basis" className="inline-flex rounded-lg border border-card-border p-0.5">
      {OPTIONS.map((o) => (
        <InfoTooltip key={o.value} content={o.hint} side="bottom">
          <button
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 rounded-md px-3 py-1 text-xs font-medium transition-colors lg:min-h-0 lg:px-2.5 lg:text-[11px]",
              value === o.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        </InfoTooltip>
      ))}
    </div>
  )
}

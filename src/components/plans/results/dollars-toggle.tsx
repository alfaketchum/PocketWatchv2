"use client"

import { InfoTooltip } from "@/components/ui/info-tooltip"
import { cn } from "@/lib/utils"
import type { DollarBasis } from "@/lib/plans/plan-types"

const OPTIONS: { value: DollarBasis; label: string; hint: string }[] = [
  {
    value: "today",
    label: "Today's $",
    hint: "Inflation taken out: every year is shown in what money buys today. $100k in 2050 here means what $100k buys now, so years compare directly. Best for judging your lifestyle.",
  },
  {
    value: "future",
    label: "Future $",
    hint: "The actual dollar amounts of each year, inflation included (nominal). Numbers grow over time even when buying power doesn't; these are the figures you'd see on statements and tax forms then.",
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
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
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

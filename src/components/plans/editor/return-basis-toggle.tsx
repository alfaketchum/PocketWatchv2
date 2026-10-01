"use client"

import { InfoTooltip } from "@/components/ui/info-tooltip"
import { cn } from "@/lib/utils"
import { fmtPct } from "@/components/fire/fire-helpers"
import { returnBasisOf, withSettings, type ReturnBasis } from "@/lib/plans/plan-returns"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"

const OPTIONS: { value: ReturnBasis; label: string; hint: (inflation: number) => string }[] = [
  {
    value: "nominal",
    label: "Before inflation",
    hint: (i) => `Enter returns the way they're usually quoted ("stocks return about 10% a year"). The plan takes ${fmtPct(i, 1)} inflation off to see what that buys.`,
  },
  {
    value: "real",
    label: "After inflation",
    hint: (i) => `Enter what your money grows in buying power ("about 6–7% above inflation"). The plan adds ${fmtPct(i, 1)} inflation back on, and if you change inflation these stay the same.`,
  },
]

/** How this plan's account returns are entered: before inflation (nominal) or after it (real). */
export function ReturnBasisToggle({ doc, update }: { doc: PlanDocument; update: PlanEditorProps["update"] }) {
  const value = returnBasisOf(doc.settings)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-foreground-muted">Returns are</span>
      <div role="radiogroup" aria-label="Returns are entered" className="inline-flex rounded-lg border border-card-border p-0.5">
        {OPTIONS.map((o) => (
          <InfoTooltip key={o.value} content={o.hint(doc.settings.inflation)} side="bottom">
            <button
              type="button"
              role="radio"
              aria-checked={value === o.value}
              onClick={() => update((d) => withSettings(d, { returnBasis: o.value }))}
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
    </div>
  )
}

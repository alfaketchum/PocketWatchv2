"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtPct } from "./fire-helpers"
import { FireBasicInputs } from "./fire-basic-inputs"
import { FireInputsPanel } from "./fire-inputs-panel"

/** One-line summary of the plan's assumptions; Edit expands the Basic or Advanced editor inline. */
export function FireAssumptionsRow({ state }: { state: FirePlanState }) {
  const [open, setOpen] = useState(false)
  const { inputs, plan } = state
  const advanced = inputs.mode === "advanced"

  const chips = [
    `Age ${inputs.currentAge}`,
    `${fmtCompact(plan.annualSpend)}/yr spend`,
    `${fmtCompact(plan.annualContribution)}/yr invested until FI`,
    `${fmtPct(plan.swr, 2)} withdrawals`,
    ...(advanced ? [`${fmtPct(inputs.realReturn, 1)} real return`, `${inputs.horizonYears}-yr retirement`] : []),
  ]

  return (
    <div className="border-t border-card-border mt-5 pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-foreground-muted truncate">{chips.join(" · ")}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex items-center gap-1.5 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
            open ? "border-primary bg-primary text-white" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{open ? "check" : "tune"}</span>
          {open ? "Done" : "Edit plan"}
        </button>
      </div>
      {open && <div className="mt-4">{advanced ? <FireInputsPanel state={state} /> : <FireBasicInputs state={state} />}</div>}
    </div>
  )
}

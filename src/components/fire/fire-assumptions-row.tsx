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
    `${fmtCompact(plan.annualContribution)}/yr invested`,
    `${fmtPct(plan.swr, 2)} withdrawals`,
    ...(advanced ? [`${fmtPct(inputs.realReturn, 1)} real return`, `${inputs.horizonYears}-yr retirement`] : []),
  ]

  return (
    <div className="border-t border-card-border mt-5 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left group"
      >
        <span className="text-[11px] text-foreground-muted truncate">{chips.join(" · ")}</span>
        <span className="flex items-center gap-0.5 text-[11px] font-medium text-primary shrink-0">
          {open ? "Done" : "Edit"}
          <span className={cn("material-symbols-rounded transition-transform", open && "rotate-180")} style={{ fontSize: 16 }}>
            expand_more
          </span>
        </span>
      </button>
      {open && <div className="mt-4">{advanced ? <FireInputsPanel state={state} /> : <FireBasicInputs state={state} />}</div>}
    </div>
  )
}

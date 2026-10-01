"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { IncomeStopPicker } from "./income-stop-picker"
import { TimingPicker } from "./timing-picker"

export interface DivorceDraft {
  when: Timing
  endIncomeIds: string[]
  exShare: number
  legalCost: number
  supportPerYear: number
  years: number
  incomeTaxRate: number
  capitalGainsRate: number
}

/** Divorce form: when, whose income stops, the account split, costs and support. Spending is edited on Expenses. */
export function DivorceFields({ d, set, doc }: { d: DivorceDraft; set: (change: Partial<DivorceDraft>) => void; doc: PlanDocument }) {
  return (
    <>
      <TimingPicker label="When" value={d.when} doc={doc} allow={["year", "age", "milestone"]} onChange={(when) => set({ when })} />
      <IncomeStopPicker doc={doc} label="Income that stops (your ex's)" value={d.endIncomeIds} onChange={(endIncomeIds) => set({ endIncomeIds })} />
      <FireNumberField
        label="Your ex keeps (share of each account)"
        suffix="%"
        scale={100}
        min={0}
        max={1}
        value={d.exShare}
        hint="Moved out untaxed, as transfers in a divorce are. Homes and debts are edited on Assets & debts."
        onChange={(exShare) => set({ exShare })}
      />
      <FireNumberField label="Legal and moving costs" prefix="$" min={0} value={d.legalCost} onChange={(legalCost) => set({ legalCost })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Support you pay / yr (0 for none)" prefix="$" min={0} value={d.supportPerYear} onChange={(supportPerYear) => set({ supportPerYear })} />
        <FireNumberField label="For how many years" min={1} max={40} value={d.years} onChange={(years) => set({ years })} />
      </div>
      {doc.settings.taxMode === "brackets" ? (
        <p className="text-[11px] text-foreground-muted">You file single from then on. Spending changes go on Expenses (lines can stop or start at this milestone).</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField label="New income tax rate" suffix="%" scale={100} min={0} max={1} value={d.incomeTaxRate} hint="Filing single often raises it." onChange={(incomeTaxRate) => set({ incomeTaxRate })} />
          <FireNumberField label="New capital gains rate" suffix="%" scale={100} min={0} max={1} value={d.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
        </div>
      )}
    </>
  )
}

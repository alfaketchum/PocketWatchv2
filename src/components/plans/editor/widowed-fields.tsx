"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { IncomeStopPicker, personIncomeIds } from "./income-stop-picker"
import { SelectField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

export interface WidowedDraft {
  personId: string
  when: Timing
  endIncomeIds: string[]
  survivorBenefit: boolean
  lifeInsurance: number
  finalCosts: number
  incomeTaxRate: number
  capitalGainsRate: number
}

/** A partner passes away: who and when, their income that stops, the survivor benefit, insurance and costs. */
export function WidowedFields({ d, set, doc }: { d: WidowedDraft; set: (change: Partial<WidowedDraft>) => void; doc: PlanDocument }) {
  if (doc.people.length < 2) return <p className="text-xs text-foreground-muted">Add your partner on Assumptions → People first.</p>
  const people = doc.people.map((p) => ({ value: p.id, label: p.name }))
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Who" value={d.personId} options={people} onChange={(personId) => set({ personId, endIncomeIds: personIncomeIds(doc, personId) })} />
        <TimingPicker label="When" value={d.when} doc={doc} allow={["year", "age", "milestone"]} onChange={(when) => set({ when })} />
      </div>
      <IncomeStopPicker doc={doc} label="Their income that stops" value={d.endIncomeIds} onChange={(endIncomeIds) => set({ endIncomeIds })} />
      <Toggle label="Survivor benefit: your Social Security steps up to theirs if theirs was larger" checked={d.survivorBenefit} onChange={(survivorBenefit) => set({ survivorBenefit })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Life insurance payout (tax-free)" prefix="$" min={0} value={d.lifeInsurance} onChange={(lifeInsurance) => set({ lifeInsurance })} />
        <FireNumberField label="Funeral and final costs" prefix="$" min={0} value={d.finalCosts} onChange={(finalCosts) => set({ finalCosts })} />
      </div>
      {doc.settings.taxMode === "brackets" ? (
        <p className="text-[11px] text-foreground-muted">
          You file single from then on. Accounts stay yours. Spending changes go on Expenses (lines can stop or start at this milestone).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField label="New income tax rate" suffix="%" scale={100} min={0} max={1} value={d.incomeTaxRate} onChange={(incomeTaxRate) => set({ incomeTaxRate })} />
          <FireNumberField label="New capital gains rate" suffix="%" scale={100} min={0} max={1} value={d.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
        </div>
      )}
    </>
  )
}

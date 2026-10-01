"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { WHEN_TYPES, type SetDraft, type TemplateDraft } from "./template-draft"

/** Get married: when, the partner and their pay, new tax rates and the wedding. */
export function MarriedFields({ d, set, doc }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  return (
    <>
      <TimingPicker label="When" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(when) => set({ when })} />
      {doc.people.length < 2 && <Toggle label="Add your partner to the plan" checked={d.partnerOn} onChange={(partnerOn) => set({ partnerOn })} />}
      {d.partnerOn && doc.people.length < 2 && (
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Partner's name" value={d.partnerName} maxLength={40} onChange={(partnerName) => set({ partnerName })} />
          <FireNumberField label="Birth year" min={1900} max={2200} value={d.partnerBirthYear} onChange={(partnerBirthYear) => set({ partnerBirthYear })} />
          <div className="col-span-2">
            <FireNumberField label="Their salary / yr (0 for none)" prefix="$" min={0} value={d.partnerIncome} onChange={(partnerIncome) => set({ partnerIncome })} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="New income tax rate" suffix="%" scale={100} min={0} max={1} value={d.incomeTaxRate} hint="Filing jointly often lowers it." onChange={(incomeTaxRate) => set({ incomeTaxRate })} />
        <FireNumberField label="New capital gains rate" suffix="%" scale={100} min={0} max={1} value={d.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
      </div>
      <FireNumberField label="Wedding cost (0 for none)" prefix="$" min={0} value={d.weddingCost} onChange={(weddingCost) => set({ weddingCost })} />
    </>
  )
}

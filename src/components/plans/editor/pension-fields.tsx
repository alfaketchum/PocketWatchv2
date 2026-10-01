"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { SelectField, TextField } from "./plan-editor-controls"

export interface PensionDraft {
  name: string
  personId: string
  amount: number
  age: number
  raises: boolean
}

/** A pension: whose, how much, from what age, and whether it gets cost-of-living raises. */
export function PensionFields({ d, set, doc }: { d: PensionDraft; set: (change: Partial<PensionDraft>) => void; doc: PlanDocument }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
        {doc.people.length > 1 && (
          <SelectField label="Whose" value={d.personId} options={doc.people.map((p) => ({ value: p.id, label: p.name }))} onChange={(personId) => set({ personId })} />
        )}
        <FireNumberField label="Per year" prefix="$" min={0} value={d.amount} onChange={(amount) => set({ amount })} />
        <FireNumberField label="Starts at age" min={40} max={90} value={d.age} onChange={(age) => set({ age: Math.round(age) })} />
      </div>
      <Toggle label="Cost-of-living raises (keeps up with inflation)" checked={d.raises} onChange={(raises) => set({ raises })} />
      <p className="text-[11px] text-foreground-muted">
        {d.raises
          ? "Entered in today's dollars and rising with prices, like most government pensions."
          : "Pays these same dollars every year, like most private pensions: inflation slowly shrinks what it buys."}
      </p>
    </>
  )
}

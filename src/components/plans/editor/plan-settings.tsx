"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import type { PlanPerson, PlanSettings } from "@/lib/plans/plan-types"
import { patchItem, type PlanEditorProps } from "../plans-helpers"
import { TextField } from "./plan-editor-controls"

function PersonFields({ person, onChange }: { person: PlanPerson; onChange: (change: Partial<PlanPerson>) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
      <div className="col-span-2 sm:col-span-1">
        <TextField label="Name" value={person.name} maxLength={40} onChange={(name) => onChange({ name })} />
      </div>
      <FireNumberField label="Birth year" min={1900} max={2200} value={person.birthYear} onChange={(birthYear) => onChange({ birthYear })} />
      <FireNumberField label="Birth month" min={1} max={12} value={person.birthMonth} onChange={(birthMonth) => onChange({ birthMonth })} />
    </div>
  )
}

/** Plan-wide assumptions: who's in it, how long it runs, inflation and tax rates. */
export function PlanSettingsEditor({ doc, update }: PlanEditorProps) {
  const set = (change: Partial<PlanSettings>) => update((d) => ({ ...d, settings: { ...d.settings, ...change } }))
  const s = doc.settings

  return (
    <div className="space-y-6">
      <InputBlock title="People" description="Birth dates, not ages, so the plan stays right as years pass.">
        {doc.people.map((p) => (
          <PersonFields
            key={p.id}
            person={p}
            onChange={(change) => update((d) => ({ ...d, people: patchItem(d.people, p.id, change) }))}
          />
        ))}
      </InputBlock>
      <InputBlock title="Timeline">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <FireNumberField label="Plan starts (year)" min={1900} max={2200} value={s.startYear} onChange={(startYear) => set({ startYear })} />
          <FireNumberField label="Start month" min={1} max={12} value={s.startMonth} onChange={(startMonth) => set({ startMonth })} />
          <FireNumberField label="Plan until age" min={1} max={120} value={s.endAge} onChange={(endAge) => set({ endAge })} />
        </div>
      </InputBlock>
      <InputBlock title="Assumptions" description="Flat effective rates; real tax brackets come later.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FireNumberField label="Inflation" suffix="%" scale={100} min={-0.05} max={0.2} value={s.inflation} onChange={(inflation) => set({ inflation })} />
          <FireNumberField
            label="Income tax (effective)"
            suffix="%"
            scale={100}
            min={0}
            max={1}
            value={s.incomeTaxRate}
            hint="Also applies to traditional withdrawals."
            onChange={(incomeTaxRate) => set({ incomeTaxRate })}
          />
          <FireNumberField
            label="Capital gains tax"
            suffix="%"
            scale={100}
            min={0}
            max={1}
            value={s.capitalGainsRate}
            onChange={(capitalGainsRate) => set({ capitalGainsRate })}
          />
          <FireNumberField
            label="Cash buffer (today's $)"
            prefix="$"
            min={0}
            value={s.cashBuffer}
            onChange={(cashBuffer) => set({ cashBuffer })}
          />
        </div>
      </InputBlock>
    </div>
  )
}

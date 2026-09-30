"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanPerson, PlanSettings } from "@/lib/plans/plan-types"
import { removePerson } from "@/lib/plans/plan-edits"
import { newItemId, patchItem, type PlanEditorProps } from "../plans-helpers"
import { AdjustmentsEditor } from "./adjustments-editor"
import { TextField } from "./plan-editor-controls"
import { PlanTaxSettings } from "./plan-tax-settings"

function newPartner(birthYear: number): PlanPerson {
  return { id: newItemId("person"), name: "Partner", birthYear, birthMonth: 1 }
}

function PersonFields({
  person,
  onChange,
  onRemove,
}: {
  person: PlanPerson
  onChange: (change: Partial<PlanPerson>) => void
  onRemove?: () => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
      <div className="col-span-2 sm:col-span-1">
        <TextField label="Name" value={person.name} maxLength={40} onChange={(name) => onChange({ name })} />
      </div>
      <FireNumberField label="Birth year" min={1900} max={2200} value={person.birthYear} onChange={(birthYear) => onChange({ birthYear })} />
      <FireNumberField label="Birth month" min={1} max={12} value={person.birthMonth} onChange={(birthMonth) => onChange({ birthMonth })} />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${person.name}`}
          className="btn-ghost h-[34px] px-2 text-foreground-muted hover:text-error"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            delete
          </span>
        </button>
      ) : (
        <span className="hidden sm:block w-[34px]" />
      )}
    </div>
  )
}

/** The Assumptions tab: who's in the plan, how long it runs, inflation and taxes. */
export function PlanSettingsEditor({ doc, update }: PlanEditorProps) {
  const set = (change: Partial<PlanSettings>) => update((d) => ({ ...d, settings: { ...d.settings, ...change } }))
  const s = doc.settings

  return (
    <div className="space-y-6">
      <InputBlock
        title="People"
        description="Birth dates, not ages, so the plan stays right as years pass. The plan runs until the first person reaches the end age."
      >
        {doc.people.map((p, i) => (
          <PersonFields
            key={p.id}
            person={p}
            onChange={(change) => update((d) => ({ ...d, people: patchItem(d.people, p.id, change) }))}
            onRemove={i === 0 ? undefined : () => update((d) => removePerson(d, p.id))}
          />
        ))}
        {doc.people.length < PLAN_LIMITS.people && (
          <button
            type="button"
            onClick={() => update((d) => ({ ...d, people: [...d.people, newPartner(d.people[0]?.birthYear ?? d.settings.startYear - 35)] }))}
            className="text-[11px] text-primary hover:underline"
          >
            + Add partner
          </button>
        )}
      </InputBlock>
      <InputBlock title="Timeline" description="The cash buffer (emergency fund) is on the Cash flow tab.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FireNumberField label="Plan starts (year)" min={1900} max={2200} value={s.startYear} onChange={(startYear) => set({ startYear })} />
          <FireNumberField label="Start month" min={1} max={12} value={s.startMonth} onChange={(startMonth) => set({ startMonth })} />
          <FireNumberField label="Plan until age" min={1} max={120} value={s.endAge} onChange={(endAge) => set({ endAge })} />
          <FireNumberField label="Inflation" suffix="%" scale={100} min={-0.05} max={0.2} value={s.inflation} onChange={(inflation) => set({ inflation })} />
        </div>
      </InputBlock>
      <PlanTaxSettings settings={s} set={set} />
      <AdjustmentsEditor doc={doc} update={update} />
    </div>
  )
}

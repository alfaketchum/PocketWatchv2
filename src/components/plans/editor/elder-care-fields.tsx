"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { ChoiceChips, Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { AIDE_HOURS_PART_TIME, aideYearly, CARE_LABELS, careDefaults, surveyToToday, yourShare, type CareArrangement, type CarePayer } from "@/lib/plans/elder-care"
import { NO_STATE, STATE_OPTIONS } from "./plan-tax-settings"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { SelectField, TextField } from "./plan-editor-controls"

export interface ElderCareDraft {
  name: string
  /** Where they live (state code), for typical costs; null = national average. */
  careState: string | null
  arrangement: CareArrangement
  startYear: number
  years: number
  yearlyCost: number
  oneTimeCost: number
  aidePerYear: number
  payer: CarePayer
  parentShare: number
  cutWork: boolean
  incomeId: string
  workKeep: number
}

const ARRANGEMENTS = (Object.keys(CARE_LABELS) as CareArrangement[]).map((value) => ({ value, label: CARE_LABELS[value] }))
const PAYERS: { value: CarePayer; label: string }[] = [
  { value: "parent", label: "They pay it all" },
  { value: "shared", label: "They pay part" },
  { value: "you", label: "You pay it all" },
]

/** Elder care: how they're cared for, for how long, what it costs and who pays, and any cut to your own work. */
export function ElderCareFields({ d, set, doc }: { d: ElderCareDraft; set: (change: Partial<ElderCareDraft>) => void; doc: PlanDocument }) {
  const uplift = surveyToToday(doc.settings)
  const meta = careDefaults(d.arrangement, d.careState, uplift)
  const incomes = doc.incomes.filter((i) => !i.oneTime).map((i) => ({ value: i.id, label: i.name }))
  const yearly = d.yearlyCost + (d.arrangement === "moveIn" ? d.aidePerYear : 0)
  const share = yourShare(d)
  // Picking an arrangement or a state resets the costs to that state's typical ones.
  const reset = (arrangement: CareArrangement, careState: string | null) => {
    const typical = careDefaults(arrangement, careState, uplift)
    set({ arrangement, careState, yearlyCost: typical.yearly, oneTimeCost: typical.oneTime, aidePerYear: 0 })
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <TextField label="Who" value={d.name} maxLength={40} onChange={(name) => set({ name })} />
        <FireNumberField label="Starting in (year)" min={1900} max={2200} value={d.startYear} onChange={(startYear) => set({ startYear })} />
        <FireNumberField label="For how many years" min={1} max={30} value={d.years} onChange={(years) => set({ years })} />
      </div>
      <SelectField
        label="Where they'll live (sets typical costs)"
        value={d.careState ?? NO_STATE}
        options={STATE_OPTIONS.map((o) => (o.value === NO_STATE ? { ...o, label: "National average" } : o))}
        onChange={(v) => reset(d.arrangement, v === NO_STATE ? null : v)}
      />
      <ChoiceChips label="Care arrangement" options={ARRANGEMENTS} value={d.arrangement} onChange={(a) => reset(a, d.careState)} />
      <p className="text-[11px] text-foreground-muted">{meta.hint}</p>
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label={d.arrangement === "moveIn" ? "Extra household costs / yr" : "Care cost / yr (today's $)"} prefix="$" min={0} value={d.yearlyCost} onChange={(yearlyCost) => set({ yearlyCost })} />
        {d.arrangement === "moveIn" && (
          <>
            <FireNumberField label="Home changes (one-time)" prefix="$" min={0} value={d.oneTimeCost} onChange={(oneTimeCost) => set({ oneTimeCost })} />
            <FireNumberField
              label="Paid help / yr (0 for none)"
              prefix="$"
              min={0}
              value={d.aidePerYear}
              hint={`A part-time aide (${AIDE_HOURS_PART_TIME} hours a week) runs about ${fmtMoney(aideYearly(d.careState, AIDE_HOURS_PART_TIME, uplift))} a year there.`}
              onChange={(aidePerYear) => set({ aidePerYear })}
            />
          </>
        )}
      </div>
      <ChoiceChips label="Who pays" options={PAYERS} value={d.payer} onChange={(payer) => set({ payer })} />
      {d.payer === "shared" && (
        <FireNumberField label="They pay (from their savings, pension, Social Security)" suffix="%" scale={100} min={0} max={1} value={d.parentShare} onChange={(parentShare) => set({ parentShare })} />
      )}
      <p className="text-[11px] text-foreground-muted">
        Your part: <span className="font-medium text-foreground">{fmtMoney(yearly * share)}</span> a year
        {d.arrangement === "moveIn" && d.oneTimeCost > 0 ? ` plus ${fmtMoney(d.oneTimeCost * share)} once` : ""}, rising with inflation. Care costs
        have recently risen faster than prices; raise the amount for a cautious plan.
      </p>
      {incomes.length > 0 && <Toggle label="Cut back my work while caring" checked={d.cutWork} onChange={(cutWork) => set({ cutWork })} />}
      {d.cutWork && incomes.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <SelectField label="Which income" value={d.incomeId} options={incomes} onChange={(incomeId) => set({ incomeId })} />
          <FireNumberField label="You keep (share of that pay)" suffix="%" scale={100} min={0} max={1} value={d.workKeep} hint="0 to stop working; the pay resumes in full when care ends." onChange={(workKeep) => set({ workKeep })} />
        </div>
      )}
    </>
  )
}

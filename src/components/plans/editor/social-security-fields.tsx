"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { fullRetirementAge, SS_EARLIEST_AGE, SS_LATEST_AGE, yearlyBenefit } from "@/lib/plans/social-security"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { ClaimAgeSlider } from "./claim-age-slider"
import { SelectField } from "./plan-editor-controls"

export interface SocialSecurityDraft {
  personId: string
  monthlyAtFra: number
  age: number
}

const fraLabel = (fra: number) => {
  const years = Math.floor(fra)
  const months = Math.round((fra - years) * 12)
  return months ? `${years} and ${months} months` : `${years}`
}

/** Claim Social Security: whose, the benefit at full retirement age, and the claiming age (with what each age pays). */
export function SocialSecurityFields({ d, set, doc }: { d: SocialSecurityDraft; set: (change: Partial<SocialSecurityDraft>) => void; doc: PlanDocument }) {
  const person = doc.people.find((p) => p.id === d.personId) ?? doc.people[0]
  const birthYear = person?.birthYear ?? doc.settings.startYear - 40
  const perMonth = (age: number) => fmtMoney(yearlyBenefit(d.monthlyAtFra, birthYear, age) / 12)
  return (
    <>
      {doc.people.length > 1 && (
        <SelectField label="Whose" value={d.personId} options={doc.people.map((p) => ({ value: p.id, label: p.name }))} onChange={(personId) => set({ personId })} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField
          label="Monthly benefit at full retirement age"
          prefix="$"
          min={0}
          value={d.monthlyAtFra}
          hint={`From your statement at ssa.gov/myaccount. Full retirement age: ${fraLabel(fullRetirementAge(birthYear))}.`}
          onChange={(monthlyAtFra) => set({ monthlyAtFra })}
        />
        <ClaimAgeSlider age={d.age} birthYear={birthYear} monthlyAtFra={d.monthlyAtFra} onChange={(age) => set({ age })} />
      </div>
      <p className="text-[11px] text-foreground-muted">
        Today&apos;s dollars, rising with inflation. Claiming later pays more each month: from {perMonth(SS_EARLIEST_AGE)} at {SS_EARLIEST_AGE} to{" "}
        {perMonth(SS_LATEST_AGE)} at {SS_LATEST_AGE}.
      </p>
    </>
  )
}

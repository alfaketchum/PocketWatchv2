"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { fullRetirementAge, SS_EARLIEST_AGE, SS_LATEST_AGE, yearlyBenefit } from "@/lib/plans/social-security"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { estimatedPia } from "@/lib/plans/ss-plan-earnings"
import { SsEarningsFields } from "./ss-earnings-fields"

/**
 * A Social Security income's own fields: the benefit at full retirement age and the claiming age. Changing them
 * moves the start to the claiming age and refreshes the displayed amount; the engine adds the rest each year.
 */
export function SocialSecurityIncomeFields({ income, doc, onChange }: { income: PlanIncome; doc: PlanDocument; onChange: (change: Partial<PlanIncome>) => void }) {
  const details = income.socialSecurity
  const person = doc.people.find((p) => p.id === income.personId) ?? doc.people[0]
  if (!details || !person) return null
  const set = (pia: number, claimAge: number, earnings = details.earnings) =>
    onChange({
      socialSecurity: { pia, claimAge, ...(earnings ? { earnings } : {}) },
      amount: Math.round(yearlyBenefit(pia, person.birthYear, claimAge)),
      start: { type: "age", personId: person.id, age: claimAge },
    })
  const estimating = details.earnings !== undefined
  const setEarnings = (earnings: [number, number][] | undefined) => {
    const pia = earnings ? (estimatedPia(doc, { ...income, socialSecurity: { ...details, earnings } })?.pia ?? details.pia) : details.pia
    set(pia, details.claimAge, earnings)
  }
  return (
    <>
      <div className="col-span-full">
        <ChoiceChips
          label="Benefit"
          options={[
            { value: "enter", label: "Enter my benefit" },
            { value: "estimate", label: "Estimate from my earnings" },
          ]}
          value={estimating ? "estimate" : "enter"}
          onChange={(v) => setEarnings(v === "estimate" ? [] : undefined)}
        />
      </div>
      {estimating ? (
        <div className="self-end text-xs">
          <p className="text-foreground-muted">At full retirement age</p>
          <p className="py-2 font-medium tabular-nums text-foreground">{fmtMoney(estimatedPia(doc, income)?.pia ?? 0)}/mo (estimated)</p>
        </div>
      ) : (
        <FireNumberField label="At full retirement age (per month)" prefix="$" min={0} value={details.pia} onChange={(pia) => set(pia, details.claimAge)} />
      )}
      <FireNumberField label="Claim at age" min={SS_EARLIEST_AGE} max={SS_LATEST_AGE} value={details.claimAge} onChange={(age) => set(details.pia, Math.round(age))} />
      <p className="col-span-2 self-center text-[11px] text-foreground-muted">
        {fmtMoney(yearlyBenefit(details.pia, person.birthYear, details.claimAge))} a year from {details.claimAge} (full retirement age{" "}
        {fullRetirementAge(person.birthYear)}), rising with inflation. Spousal top-up and the earnings test are added each year.
      </p>
      {estimating && <SsEarningsFields income={income} doc={doc} onChange={setEarnings} />}
    </>
  )
}

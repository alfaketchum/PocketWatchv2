"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtPct } from "@/components/fire/fire-helpers"
import { conditionOf, VEHICLE_CONDITIONS, vehicleValueRatio, type VehicleCondition } from "@/lib/plans/vehicle-depreciation"
import type { SetDraft, TemplateDraft } from "./template-draft"

const OPTIONS = (Object.keys(VEHICLE_CONDITIONS) as VehicleCondition[]).map((value) => ({ value, label: VEHICLE_CONDITIONS[value].label }))

/** Brand new, pre-owned or used: sets a typical price, age and loan rate; the car then loses value for its age. */
export function VehicleConditionChips({ d, set }: { d: TemplateDraft; set: SetDraft }) {
  const condition = conditionOf(d.vehicleAge) ?? "new"
  const pick = (c: VehicleCondition) => {
    const typical = VEHICLE_CONDITIONS[c]
    const downShare = d.price > 0 ? d.downPayment / d.price : 0
    set({ vehicleAge: typical.age, price: typical.price, rate: typical.loanRate, downPayment: Math.round(typical.price * downShare) })
  }
  return (
    <div className="space-y-1">
      <ChoiceChips label="Buying" options={OPTIONS} value={condition} onChange={pick} />
      <p className="text-[11px] text-foreground-muted">
        {VEHICLE_CONDITIONS[condition].hint} At {d.vehicleAge} year{d.vehicleAge === 1 ? "" : "s"} old it loses about{" "}
        {fmtPct(1 - vehicleValueRatio(d.vehicleAge, 1), 0)} in the first year you own it and {fmtPct(1 - vehicleValueRatio(d.vehicleAge, 5), 0)} over five.
      </p>
    </div>
  )
}

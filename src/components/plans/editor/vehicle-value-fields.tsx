"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtPct } from "@/components/fire/fire-helpers"
import { vehicleValueRatio } from "@/lib/plans/vehicle-depreciation"
import { SelectField } from "./plan-editor-controls"

const MODES = [
  { value: "curve", label: "Typical, by age" },
  { value: "flat", label: "Flat rate" },
]

/** A typical age when switching to the curve from a flat rate. */
const DEFAULT_AGE = 3

/**
 * How a vehicle loses value: the typical curve for its age (steep the first years, slower later) or one flat
 * yearly rate. `later` is true for a future purchase (its age when bought), false for one owned today.
 */
export function VehicleValueFields({
  vehicleAge,
  appreciation,
  later,
  onChange,
}: {
  vehicleAge: number | undefined
  appreciation: number
  later: boolean
  onChange: (change: { vehicleAge?: number; appreciation?: number }) => void
}) {
  const curve = vehicleAge !== undefined
  return (
    <>
      <SelectField
        label="Depreciation"
        value={curve ? "curve" : "flat"}
        options={MODES}
        onChange={(mode) => onChange(mode === "curve" ? { vehicleAge: DEFAULT_AGE } : { vehicleAge: undefined })}
      />
      {curve ? (
        <FireNumberField
          label={later ? "Age when bought (years)" : "Age today (years)"}
          min={0}
          max={50}
          value={vehicleAge}
          hint={`Loses about ${fmtPct(1 - vehicleValueRatio(vehicleAge, 1), 0)} in the next year and ${fmtPct(1 - vehicleValueRatio(vehicleAge, 5), 0)} over five.`}
          onChange={(age) => onChange({ vehicleAge: Math.max(0, Math.round(age)) })}
        />
      ) : (
        <FireNumberField label="Value change / yr" suffix="%" scale={100} min={-0.5} max={1} value={appreciation} onChange={(a) => onChange({ appreciation: a })} />
      )}
    </>
  )
}

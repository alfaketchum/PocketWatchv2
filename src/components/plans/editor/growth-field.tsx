"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"

/** Annual growth rate that follows inflation until the user overrides it. */
export function GrowthField({
  value,
  inflation,
  onChange,
}: {
  value: number | null
  inflation: number
  onChange: (value: number | null) => void
}) {
  return (
    <FireNumberField
      label="Grows / yr"
      suffix="%"
      scale={100}
      min={-0.5}
      max={1}
      value={value ?? inflation}
      onChange={onChange}
      auto={{ isAuto: value === null, onReset: () => onChange(null) }}
    />
  )
}

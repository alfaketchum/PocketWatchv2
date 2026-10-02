"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtPct } from "@/components/fire/fire-helpers"
import { CLIFF_OPTIONS, presetOf, VESTING_EVERY, VESTING_PRESETS, vestingByYear } from "@/lib/plans/plan-vesting"
import type { VestingSchedule } from "@/lib/plans/plan-types"
import { SelectField } from "./plan-editor-controls"

const CUSTOM = "custom"
const MAX_YEARS = 10
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const PRESET_OPTIONS = [...VESTING_PRESETS.map((p) => ({ value: p.key as string, label: p.label })), { value: CUSTOM, label: "Custom" }]
const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))
const asOptions = (list: readonly { value: number; label: string }[]) => list.map((o) => ({ value: String(o.value), label: o.label }))

/** Each year's share, editable (Custom), with years added or taken off the end. */
function YearlyShares({ yearly, onChange }: { yearly: number[]; onChange: (yearly: number[]) => void }) {
  const total = yearly.reduce((s, v) => s + v, 0)
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 items-end">
        {yearly.map((share, i) => (
          <FireNumberField
            key={i}
            label={`Year ${i + 1}`}
            suffix="%"
            scale={100}
            min={0}
            max={1}
            value={share}
            onChange={(v) => onChange(yearly.map((s, j) => (j === i ? v : s)))}
          />
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-3 text-[11px] text-foreground-muted">
        <span className={Math.abs(total - 1) > 0.005 ? "text-warning" : undefined}>Adds up to {fmtPct(total, 0)}{Math.abs(total - 1) > 0.005 ? " (scaled to 100%)" : ""}</span>
        {yearly.length < MAX_YEARS && (
          <button type="button" onClick={() => onChange([...yearly, 0])} className="text-primary hover:underline">
            + Year
          </button>
        )}
        {yearly.length > 1 && (
          <button type="button" onClick={() => onChange(yearly.slice(0, -1))} className="text-primary hover:underline">
            − Year
          </button>
        )}
      </p>
    </div>
  )
}

/** What vests in each calendar year from the grant, as shares of it (one grant, before refreshers). */
function VestingPreview({ vesting, firstYear, shares }: { vesting: VestingSchedule; firstYear: number; shares: number }) {
  const byYear = vestingByYear(vesting)
  return (
    <div className="flex flex-wrap gap-1.5">
      {byYear.map((share, i) => (
        <span key={i} className="rounded-md bg-foreground/5 px-2 py-1 text-[11px] tabular-nums text-foreground-muted">
          <span className="font-medium text-foreground">{firstYear + i}</span> {share > 0 ? `${fmtPct(share, 0)} · ${Math.round(shares * share).toLocaleString()} sh` : "—"}
        </span>
      ))}
    </div>
  )
}

/** An RSU grant's vesting: schedule, cliff, how often, grant month and refreshers, with a year-by-year preview. */
export function VestingFields({
  vesting,
  shares,
  firstYear,
  onChange,
}: {
  vesting: VestingSchedule
  shares: number
  /** Calendar year of the grant (the income's start). */
  firstYear: number
  onChange: (change: Partial<VestingSchedule>) => void
}) {
  // Custom stays open even while its shares happen to match a preset.
  const [custom, setCustom] = useState(() => presetOf(vesting) === null)
  const preset = custom ? CUSTOM : (presetOf(vesting) ?? CUSTOM)
  const pickPreset = (key: string) => {
    const found = VESTING_PRESETS.find((p) => p.key === key)
    setCustom(!found)
    if (found) onChange({ yearly: [...found.yearly] })
  }
  return (
    <div className="space-y-2 rounded-lg bg-background-secondary/40 p-2.5">
      <p className="text-[11px] font-medium text-foreground-muted">Vesting</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <SelectField label="Schedule" value={preset} options={PRESET_OPTIONS} onChange={pickPreset} />
        <SelectField label="Cliff" value={String(vesting.cliffMonths)} options={asOptions(CLIFF_OPTIONS)} onChange={(v) => onChange({ cliffMonths: Number(v) })} />
        <SelectField label="Then vests" value={String(vesting.every)} options={asOptions(VESTING_EVERY)} onChange={(v) => onChange({ every: Number(v) })} />
        <SelectField label="Granted in" value={String(vesting.grantMonth)} options={MONTH_OPTIONS} onChange={(v) => onChange({ grantMonth: Number(v) })} />
      </div>
      {preset === CUSTOM && <YearlyShares yearly={vesting.yearly} onChange={(yearly) => onChange({ yearly })} />}
      <VestingPreview vesting={vesting} firstYear={firstYear} shares={shares} />
      <Toggle label="A new grant of the same value every year (refreshers)" checked={vesting.refresh} onChange={(refresh) => onChange({ refresh })} />
      <p className="text-[11px] text-foreground-muted">
        Leaving (the Stops date) forfeits anything not yet vested, so leaving before the cliff gets nothing.
        {vesting.refresh ? " Refreshers stack up: after a few years, about one whole grant vests each year." : ""}
      </p>
    </div>
  )
}

"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanAdjustment } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type PlanEditorProps } from "../plans-helpers"
import { SelectField } from "./plan-editor-controls"
import { NO_STATE, STATE_OPTIONS } from "./plan-tax-settings"
import { RowButton } from "./plan-table"
import { TimingPicker } from "./timing-picker"

const ICONS: Record<PlanAdjustment["kind"], string> = { taxRates: "percent", spending: "shopping_cart", filingStatus: "badge", state: "location_on" }
const LABELS: Record<PlanAdjustment["kind"], string> = { taxRates: "Tax rates", spending: "Spending", filingStatus: "Filing status", state: "Living in" }

const STATUS_OPTIONS: { value: "single" | "joint"; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "joint", label: "Married filing jointly" },
]

/** The fields for one change; flat tax-rate changes only apply in flat mode, filing status only with brackets. */
function AdjustmentFields({
  adjustment: a,
  brackets,
  onChange,
}: {
  adjustment: PlanAdjustment
  brackets: boolean
  onChange: (change: Partial<PlanAdjustment>) => void
}) {
  if (a.kind === "spending") {
    return (
      <div className="w-36">
        <FireNumberField label="Your spending changes" suffix="%" scale={100} min={-0.95} max={5} value={a.percent} onChange={(percent) => onChange({ percent })} />
      </div>
    )
  }
  if (a.kind === "state") {
    return (
      <div className="w-52">
        <SelectField label="State" value={a.state ?? NO_STATE} options={STATE_OPTIONS} onChange={(v) => onChange({ state: v === NO_STATE ? null : v })} />
        {!brackets && <p className="text-[10px] text-foreground-muted mt-1">Used with tax brackets</p>}
      </div>
    )
  }
  if (a.kind === "filingStatus") {
    return (
      <div className="w-52">
        <SelectField label="Filing status" value={a.status} options={STATUS_OPTIONS} onChange={(status) => onChange({ status })} />
        {!brackets && <p className="text-[10px] text-foreground-muted mt-1">Used with tax brackets</p>}
      </div>
    )
  }
  return (
    <>
      <div className="w-28">
        <FireNumberField label="Income tax" suffix="%" scale={100} min={0} max={1} value={a.incomeTaxRate} onChange={(incomeTaxRate) => onChange({ incomeTaxRate })} />
      </div>
      <div className="w-28">
        <FireNumberField label="Capital gains" suffix="%" scale={100} min={0} max={1} value={a.capitalGainsRate} onChange={(capitalGainsRate) => onChange({ capitalGainsRate })} />
      </div>
      {brackets && <p className="self-center text-[10px] text-foreground-muted">Only used with flat rates</p>}
    </>
  )
}

/** Changes from a date onward: state or tax rates here; milestones (marriage, divorce, moves) add their own. */
export function AdjustmentsEditor({ doc, update }: PlanEditorProps) {
  const adjustments = doc.adjustments ?? []
  const ctx = timingContext(doc)
  const sorted = [...adjustments].sort((a, b) => (resolveTiming(a.timing, ctx) ?? Infinity) - (resolveTiming(b.timing, ctx) ?? Infinity))
  const set = (next: PlanAdjustment[]) => update((d) => ({ ...d, adjustments: next }))
  const patch = (id: string, change: Partial<PlanAdjustment>) =>
    update((d) => ({ ...d, adjustments: patchItem(d.adjustments ?? [], id, change as Partial<PlanAdjustment>) as PlanAdjustment[] }))
  const when = { type: "year" as const, year: doc.settings.startYear + 5 }
  const full = adjustments.length >= PLAN_LIMITS.adjustments
  const brackets = doc.settings.taxMode === "brackets"
  // Spending lives on Expenses; marriage, divorce and moves are milestones that add their own changes.
  const addOption: { label: string; make: () => PlanAdjustment } = brackets
    ? { label: "State change", make: () => ({ id: newItemId("adj"), kind: "state", timing: when, state: doc.settings.state }) }
    : {
        label: "Tax rate change",
        make: () => ({ id: newItemId("adj"), kind: "taxRates", timing: when, incomeTaxRate: doc.settings.incomeTaxRate, capitalGainsRate: doc.settings.capitalGainsRate }),
      }

  return (
    <InputBlock
      title="Changes over time"
      description="From a date on (the latest change wins). Marriage, divorce and moves are milestones: add them on the Milestones tab and they set these for you."
    >
      {sorted.map((a) => (
        <div key={a.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-card-border px-3 py-2">
          <span className="material-symbols-rounded self-center text-foreground-muted" style={{ fontSize: 18 }}>
            {ICONS[a.kind]}
          </span>
          <div className="w-40">
            <TimingPicker label={`${LABELS[a.kind]} from`} value={a.timing} doc={doc} allow={["year", "age", "milestone"]} onChange={(timing) => patch(a.id, { timing })} />
          </div>
          <AdjustmentFields adjustment={a} brackets={brackets} onChange={(change) => patch(a.id, change)} />
          <span className="ml-auto self-center">
            <RowButton icon="delete" label="Remove change" danger onClick={() => set(adjustments.filter((x) => x.id !== a.id))} />
          </span>
        </div>
      ))}
      <button type="button" disabled={full} onClick={() => set([...adjustments, addOption.make()])} className="text-[11px] text-primary hover:underline disabled:opacity-50">
        + {addOption.label}
      </button>
    </InputBlock>
  )
}

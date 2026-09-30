"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanAdjustment } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type PlanEditorProps } from "../plans-helpers"
import { RowButton } from "./plan-table"
import { TimingPicker } from "./timing-picker"

/** Tax-rate and spending-level changes from a date onward (marriage, moving, retiring abroad…). */
export function AdjustmentsEditor({ doc, update }: PlanEditorProps) {
  const adjustments = doc.adjustments ?? []
  const ctx = timingContext(doc)
  const sorted = [...adjustments].sort((a, b) => (resolveTiming(a.timing, ctx) ?? Infinity) - (resolveTiming(b.timing, ctx) ?? Infinity))
  const set = (next: PlanAdjustment[]) => update((d) => ({ ...d, adjustments: next }))
  const patch = (id: string, change: Partial<PlanAdjustment>) =>
    update((d) => ({ ...d, adjustments: patchItem(d.adjustments ?? [], id, change as Partial<PlanAdjustment>) as PlanAdjustment[] }))
  const when = { type: "year" as const, year: doc.settings.startYear + 5 }
  const full = adjustments.length >= PLAN_LIMITS.adjustments

  return (
    <InputBlock title="Changes over time" description="From a date on, the latest change wins. Marriage and Move milestones add these for you.">
      {sorted.map((a) => (
        <div key={a.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-card-border px-3 py-2">
          <span className="material-symbols-rounded self-center text-foreground-muted" style={{ fontSize: 18 }}>
            {a.kind === "taxRates" ? "percent" : "shopping_cart"}
          </span>
          <div className="w-40">
            <TimingPicker label={a.kind === "taxRates" ? "Tax rates from" : "Spending from"} value={a.timing} doc={doc} allow={["year", "age", "milestone"]} onChange={(timing) => patch(a.id, { timing })} />
          </div>
          {a.kind === "taxRates" ? (
            <>
              <div className="w-28">
                <FireNumberField label="Income tax" suffix="%" scale={100} min={0} max={1} value={a.incomeTaxRate} onChange={(incomeTaxRate) => patch(a.id, { incomeTaxRate })} />
              </div>
              <div className="w-28">
                <FireNumberField label="Capital gains" suffix="%" scale={100} min={0} max={1} value={a.capitalGainsRate} onChange={(capitalGainsRate) => patch(a.id, { capitalGainsRate })} />
              </div>
            </>
          ) : (
            <div className="w-36">
              <FireNumberField label="Your spending changes" suffix="%" scale={100} min={-0.95} max={5} value={a.percent} onChange={(percent) => patch(a.id, { percent })} />
            </div>
          )}
          <span className="ml-auto self-center">
            <RowButton icon="delete" label="Remove change" danger onClick={() => set(adjustments.filter((x) => x.id !== a.id))} />
          </span>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={full}
          onClick={() =>
            set([...adjustments, { id: newItemId("adj"), kind: "taxRates", timing: when, incomeTaxRate: doc.settings.incomeTaxRate, capitalGainsRate: doc.settings.capitalGainsRate }])
          }
          className="text-[11px] text-primary hover:underline disabled:opacity-50"
        >
          + Tax rate change
        </button>
        <button
          type="button"
          disabled={full}
          onClick={() => set([...adjustments, { id: newItemId("adj"), kind: "spending", timing: when, percent: -0.1 }])}
          className="text-[11px] text-primary hover:underline disabled:opacity-50"
        >
          + Spending change
        </button>
      </div>
    </InputBlock>
  )
}

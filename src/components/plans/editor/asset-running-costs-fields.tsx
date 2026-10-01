"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { isPropertyTax, totalYearlyCost, typicalRunningCosts } from "@/lib/plans/plan-asset-costs"
import type { AssetRunningCost, PlanAsset } from "@/lib/plans/plan-types"
import { SelectField, TextField } from "./plan-editor-controls"

const MAX_COSTS = 10

const BASIS_OPTIONS: { value: AssetRunningCost["basis"]; label: string }[] = [
  { value: "dollars", label: "$ a year" },
  { value: "percentOfValue", label: "% of value a year" },
]

/** Insurance, maintenance, property tax…: yearly costs charged while the asset is owned. */
export function AssetRunningCostsFields({ asset, state, onChange }: { asset: PlanAsset; state: string | null; onChange: (costs: AssetRunningCost[]) => void }) {
  const costs = asset.runningCosts ?? []
  const typical = typicalRunningCosts(asset.kind, state)
  const typicalTax = typical.find(isPropertyTax)
  const patch = (i: number, change: Partial<AssetRunningCost>) => onChange(costs.map((c, j) => (j === i ? { ...c, ...change } : c)))
  const remove = (i: number) => onChange(costs.filter((_, j) => j !== i))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">Running costs</p>
      {costs.length === 0 && asset.kind === "home" && (
        <p className="text-[11px] text-warning">No property tax, insurance or maintenance yet: owning this home costs nothing in the plan.</p>
      )}
      {costs.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <TextField label="Cost" value={c.name} onChange={(name) => patch(i, { name })} />
          {c.basis === "dollars" ? (
            <FireNumberField label="Amount" prefix="$" min={0} value={c.amount} onChange={(amount) => patch(i, { amount })} />
          ) : (
            <FireNumberField label="Amount" suffix="%" scale={100} min={0} max={1} value={c.amount} onChange={(amount) => patch(i, { amount })} />
          )}
          <SelectField label="Charged as" value={c.basis} options={BASIS_OPTIONS} onChange={(basis) => patch(i, { basis, amount: 0 })} />
          <button type="button" aria-label={`Remove ${c.name}`} onClick={() => remove(i)} className="btn-ghost h-9 px-2">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              close
            </span>
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {costs.length < MAX_COSTS && (
          <button type="button" className="text-primary hover:underline" onClick={() => onChange([...costs, { name: "Cost", amount: 0, basis: "dollars" }])}>
            + Add cost
          </button>
        )}
        {costs.length === 0 && typical.length > 0 && (
          <button type="button" className="text-primary hover:underline" onClick={() => onChange(typical)}>
            Use typical costs{typicalTax ? ` (${state ?? "US"} property tax ${(typicalTax.amount * 100).toFixed(2)}%)` : ""}
          </button>
        )}
        {costs.length > 0 && (
          <span className="text-foreground-muted">
            About {fmtMoney(totalYearlyCost(asset))} a year in today&apos;s dollars, while you own it. Not changed by spending changes like a move.
          </span>
        )}
      </div>
    </div>
  )
}

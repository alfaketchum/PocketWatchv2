"use client"

import type { FireFlow } from "@/lib/fire/fire-types"
import { FireNumberField } from "./fire-number-field"

const MAX_FLOWS = 10

interface FireFlowsEditorProps {
  flows: FireFlow[]
  onChange: (flows: FireFlow[]) => void
}

function newFlow(index: number): FireFlow {
  return {
    id: `flow-${Date.now()}-${index}`,
    label: index === 0 ? "Social Security" : "Pension",
    startAge: 67,
    endAge: null,
    annualAmount: 24_000,
  }
}

/** Social Security / pension / other retirement income that reduces what the portfolio must fund. */
export function FireFlowsEditor({ flows, onChange }: FireFlowsEditorProps) {
  const patch = (id: string, change: Partial<FireFlow>) =>
    onChange(flows.map((f) => (f.id === id ? { ...f, ...change } : f)))

  return (
    <div className="space-y-3">
      {flows.length === 0 && (
        <p className="text-xs text-foreground-muted">
          No retirement income added. Social Security or a pension later in life lets you withdraw more early on.
        </p>
      )}
      {flows.map((f) => (
        <div key={f.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] gap-2 items-end">
          <label className="block col-span-2 sm:col-span-1">
            <span className="block text-[11px] font-medium text-foreground-muted mb-1">Source</span>
            <input
              value={f.label}
              maxLength={60}
              onChange={(e) => patch(f.id, { label: e.target.value })}
              className="w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <FireNumberField label="Per year" prefix="$" value={f.annualAmount} onChange={(annualAmount) => patch(f.id, { annualAmount })} />
          <FireNumberField label="From age" value={f.startAge} min={0} max={120} onChange={(startAge) => patch(f.id, { startAge })} />
          <FireNumberField
            label="Until age (0 = life)"
            value={f.endAge ?? 0}
            min={0}
            max={120}
            onChange={(endAge) => patch(f.id, { endAge: endAge > 0 ? endAge : null })}
          />
          <button
            type="button"
            onClick={() => onChange(flows.filter((x) => x.id !== f.id))}
            className="btn-ghost h-[34px] px-2 text-foreground-muted hover:text-error"
            aria-label={`Remove ${f.label}`}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
          </button>
        </div>
      ))}
      {flows.length < MAX_FLOWS && (
        <button type="button" onClick={() => onChange([...flows, newFlow(flows.length)])} className="btn-secondary text-xs">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
          Add income
        </button>
      )}
    </div>
  )
}

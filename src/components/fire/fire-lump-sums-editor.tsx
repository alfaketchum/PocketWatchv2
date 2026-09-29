"use client"

import type { FireLumpSum } from "@/lib/fire/fire-types"
import { FireNumberField } from "./fire-number-field"

const MAX_LUMP_SUMS = 10

interface FireLumpSumsEditorProps {
  lumpSums: FireLumpSum[]
  currentAge: number
  onChange: (lumpSums: FireLumpSum[]) => void
}

function newLumpSum(currentAge: number, index: number): FireLumpSum {
  return {
    id: `lump-${Date.now()}-${index}`,
    label: index === 0 ? "Inheritance" : "Windfall",
    age: currentAge + 15,
    amount: 250_000,
  }
}

/** One-time inflows (inheritance, home sale). Before FI they speed it up; after, they enter the simulation. */
export function FireLumpSumsEditor({ lumpSums, currentAge, onChange }: FireLumpSumsEditorProps) {
  const patch = (id: string, change: Partial<FireLumpSum>) =>
    onChange(lumpSums.map((l) => (l.id === id ? { ...l, ...change } : l)))

  return (
    <div className="space-y-3">
      {lumpSums.length === 0 && (
        <p className="text-xs text-foreground-muted">
          Expecting an inheritance or other one-time amount? Add it in today&apos;s dollars and the age you expect it.
        </p>
      )}
      {lumpSums.map((l) => (
        <div key={l.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] gap-2 items-end">
          <label className="block col-span-2 sm:col-span-1">
            <span className="block text-[11px] font-medium text-foreground-muted mb-1">Source</span>
            <input
              value={l.label}
              maxLength={60}
              onChange={(e) => patch(l.id, { label: e.target.value })}
              className="w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <FireNumberField label="Amount" prefix="$" value={l.amount} min={0} onChange={(amount) => patch(l.id, { amount })} />
          <FireNumberField label="At age" value={l.age} min={currentAge} max={120} onChange={(age) => patch(l.id, { age })} />
          <button
            type="button"
            onClick={() => onChange(lumpSums.filter((x) => x.id !== l.id))}
            className="btn-ghost h-[34px] px-2 text-foreground-muted hover:text-error"
            aria-label={`Remove ${l.label}`}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
          </button>
        </div>
      ))}
      {lumpSums.length < MAX_LUMP_SUMS && (
        <button type="button" onClick={() => onChange([...lumpSums, newLumpSum(currentAge, lumpSums.length)])} className="btn-secondary text-xs">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
          Add inheritance or one-time amount
        </button>
      )}
    </div>
  )
}

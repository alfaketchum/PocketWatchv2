"use client"

import type { PlanListItem } from "@/hooks/plans/shared"
import { FIELD_CLASS, FIELD_STYLE } from "../editor/plan-editor-controls"

interface PickerProps {
  side: "A" | "B"
  color: string
  value: string
  plans: PlanListItem[]
  onChange: (id: string) => void
}

function Picker({ side, color, value, plans, onChange }: PickerProps) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: color }}>
        {side}
      </span>
      <select aria-label={`Plan ${side}`} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS} style={FIELD_STYLE}>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isPrimary ? " (primary)" : ""}
          </option>
        ))}
      </select>
    </label>
  )
}

interface Props {
  plans: PlanListItem[]
  aId: string
  bId: string
  colors: [string, string]
  onA: (id: string) => void
  onB: (id: string) => void
  onSwap: () => void
}

/** Plan A ⇄ plan B. */
export function ComparePickers({ plans, aId, bId, colors, onA, onB, onSwap }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Picker side="A" color={colors[0]} value={aId} plans={plans} onChange={onA} />
      <button
        type="button"
        onClick={onSwap}
        aria-label="Swap A and B"
        title="Swap A and B"
        className="self-center rounded-lg border border-card-border p-1.5 text-foreground-muted hover:bg-foreground/5 hover:text-foreground"
      >
        <span className="material-symbols-rounded block" style={{ fontSize: 18 }} aria-hidden="true">
          swap_horiz
        </span>
      </button>
      <Picker side="B" color={colors[1]} value={bId} plans={plans} onChange={onB} />
    </div>
  )
}

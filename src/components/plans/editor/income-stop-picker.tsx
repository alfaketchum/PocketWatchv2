"use client"

import { Toggle } from "@/components/fire/fire-input-controls"
import type { PlanDocument } from "@/lib/plans/plan-types"

/** Recurring incomes that look like this person's: named after them, or added with them when you married. */
export function personIncomeIds(doc: PlanDocument, personId: string | undefined): string[] {
  const name = doc.people.find((p) => p.id === personId)?.name.trim().toLowerCase()
  const married = personId !== doc.people[0]?.id
  return doc.incomes
    .filter((i) => !i.oneTime && ((name && i.name.toLowerCase().includes(name)) || (married && i.origin?.startsWith("ms-married"))))
    .map((i) => i.id)
}

/** Tick the recurring incomes that stop at a life event. */
export function IncomeStopPicker({ doc, label, value, onChange }: { doc: PlanDocument; label: string; value: string[]; onChange: (ids: string[]) => void }) {
  const incomes = doc.incomes.filter((i) => !i.oneTime)
  if (incomes.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-foreground-muted">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {incomes.map((i) => (
          <Toggle key={i.id} label={i.name} checked={value.includes(i.id)} onChange={(on) => onChange(on ? [...value, i.id] : value.filter((x) => x !== i.id))} />
        ))}
      </div>
    </div>
  )
}

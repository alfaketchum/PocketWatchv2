"use client"

import type { PlanDocument } from "@/lib/plans/plan-types"
import { SelectField } from "./plan-editor-controls"
import type { SetDraft, TemplateDraft } from "./template-draft"

/** Pick which recurring income a template changes. */
export function IncomePicker({ d, set, doc }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  const options = doc.incomes.filter((i) => !i.oneTime).map((i) => ({ value: i.id, label: i.name }))
  if (options.length === 0) return <p className="text-xs text-foreground-muted">Add an income on the Income tab first.</p>
  return <SelectField label="Which income" value={d.incomeId} options={options} onChange={(incomeId) => set({ incomeId })} />
}

"use client"

import { InputBlock } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import type { PlanDeposit } from "@/lib/plans/plan-types"
import { patchItem, type PlanEditorProps } from "../plans-helpers"
import { RowButton } from "./plan-table"
import { SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

/** One-time money that lands straight in an account (inherited investments or IRAs, gifts). */
export function DepositsEditor({ doc, update }: PlanEditorProps) {
  const deposits = doc.deposits ?? []
  if (deposits.length === 0) return null
  const patch = (id: string, change: Partial<PlanDeposit>) => update((d) => ({ ...d, deposits: patchItem(d.deposits ?? [], id, change) }))
  const accounts = doc.accounts.map((a) => ({ value: a.id, label: a.name }))
  return (
    <InputBlock
      title="Received into accounts"
      description="Arrives in the account directly, not through your cash flow. Inherited investments come in at a stepped-up basis."
    >
      {deposits.map((d) => (
        <div key={d.id} className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_0.9fr_1fr_auto] gap-2 items-end rounded-lg border border-card-border px-3 py-2">
          <TextField label="Name" value={d.name} onChange={(name) => patch(d.id, { name })} />
          <SelectField label="Into" value={d.accountId} options={accounts} onChange={(accountId) => patch(d.id, { accountId })} />
          <FireNumberField label="Amount (today's $)" prefix="$" min={0} value={d.amount} onChange={(amount) => patch(d.id, { amount })} />
          <TimingPicker label="When" value={d.timing} doc={doc} allow={["year", "age", "milestone"]} onChange={(timing) => patch(d.id, { timing })} />
          <RowButton icon="delete" label={`Remove ${d.name}`} danger onClick={() => update((x) => ({ ...x, deposits: (x.deposits ?? []).filter((y) => y.id !== d.id) }))} />
        </div>
      ))}
    </InputBlock>
  )
}

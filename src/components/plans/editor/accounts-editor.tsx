"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { DEFAULT_RETURN_RATE, PLAN_LIMITS, TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, TaxTreatment } from "@/lib/plans/plan-types"
import { newItemId, patchItem, removeAccount, type PlanEditorProps } from "../plans-helpers"
import { AddButton, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"

const TREATMENT_OPTIONS = (Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((value) => ({
  value,
  label: TAX_TREATMENT_LABELS[value],
}))

function newAccount(): PlanAccount {
  return {
    id: newItemId("acct"),
    name: "New account",
    taxTreatment: "taxable",
    balance: 0,
    costBasis: null,
    returnRate: DEFAULT_RETURN_RATE,
    owner: null,
    source: null,
  }
}

/** Accounts: balances at plan start, tax bucket, and expected return. */
export function AccountsEditor({ doc, update }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanAccount>) =>
    update((d) => ({ ...d, accounts: patchItem(d.accounts, id, change) }))

  return (
    <div className="space-y-3">
      {doc.accounts.length === 0 && <EmptyNote>No accounts yet. Surplus cash has nowhere to go until you add one.</EmptyNote>}
      {doc.accounts.map((a) => (
        <ItemCard
          key={a.id}
          title={a.name || "Untitled account"}
          removeLabel={`Remove ${a.name}`}
          onRemove={() => update((d) => removeAccount(d, a.id))}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={a.name} onChange={(name) => patch(a.id, { name })} />
            </div>
            <SelectField
              label="Tax treatment"
              value={a.taxTreatment}
              options={TREATMENT_OPTIONS}
              onChange={(taxTreatment) => patch(a.id, { taxTreatment })}
            />
            <FireNumberField label="Balance today" prefix="$" min={0} value={a.balance} onChange={(balance) => patch(a.id, { balance })} />
            <FireNumberField
              label="Return / yr"
              suffix="%"
              scale={100}
              min={-0.5}
              max={1}
              value={a.returnRate}
              onChange={(returnRate) => patch(a.id, { returnRate })}
            />
            {a.taxTreatment === "taxable" && (
              <FireNumberField
                label="Cost basis"
                prefix="$"
                min={0}
                value={a.costBasis ?? a.balance}
                hint="What you paid in; gains above it pay capital-gains tax when withdrawn."
                onChange={(costBasis) => patch(a.id, { costBasis })}
              />
            )}
          </div>
        </ItemCard>
      ))}
      <AddButton
        label="Add account"
        disabled={doc.accounts.length >= PLAN_LIMITS.accounts}
        onClick={() => update((d) => ({ ...d, accounts: [...d.accounts, newAccount()] }))}
      />
      <p className="text-[11px] text-foreground-muted">
        Returns are nominal (before inflation). A 7% stock return with 3% inflation is about 4% real.
      </p>
    </div>
  )
}

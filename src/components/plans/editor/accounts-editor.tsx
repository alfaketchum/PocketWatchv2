"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtPct } from "@/components/fire/fire-helpers"
import { nominalRate, realRate } from "@/lib/plans/plan-dollars"
import { DEFAULT_RETURN_RATE, PLAN_LIMITS, TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, TaxTreatment } from "@/lib/plans/plan-types"
import { removeAccount } from "@/lib/plans/plan-edits"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { AddButton, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { RefreshBalancesButton } from "./refresh-balances-button"
import { AccountsTable } from "./accounts-table"

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
export function AccountsEditor({ doc, update, view, onEditItem }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanAccount>) =>
    update((d) => ({ ...d, accounts: patchItem(d.accounts, id, change) }))

  return (
    <div className="space-y-3">
      <RefreshBalancesButton doc={doc} update={update} />
      {doc.accounts.length === 0 && <EmptyNote>No accounts yet. Surplus cash has nowhere to go until you add one.</EmptyNote>}
      {view === "compact" ? (
        <AccountsTable doc={doc} update={update} onEditItem={onEditItem} />
      ) : doc.accounts.map((a) => (
        <ItemCard
          key={a.id} anchorId={planItemAnchor(a.id)}
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
              hint={`Nominal. ≈ ${fmtPct(realRate(a.returnRate, doc.settings.inflation), 1)} real`}
              onChange={(returnRate) => patch(a.id, { returnRate })}
            />
            {a.drainByYear != null && (
              <div className="col-span-2 lg:col-span-4 flex flex-wrap items-end gap-3">
                <div className="w-44">
                  <FireNumberField
                    label="Inherited: empty by end of"
                    min={1900}
                    max={2200}
                    value={a.drainByYear}
                    onChange={(drainByYear) => patch(a.id, { drainByYear })}
                  />
                </div>
                <p className="pb-2 text-[11px] text-foreground-muted">
                  Drawn evenly each year until then{a.taxTreatment === "traditional" ? ", taxed as income" : ""}. Most non-spouse heirs have 10 years.
                </p>
              </div>
            )}
            {a.taxTreatment === "education" && (
              <p className="col-span-2 lg:col-span-4 text-[11px] text-foreground-muted">
                Education (529) accounts grow tax-free and only pay college costs from a child&apos;s 529 plan (Expenses → Kids). They&apos;re
                never used for other spending.
              </p>
            )}
            {a.taxTreatment === "taxable" && (
              <>
                <FireNumberField
                  label="Cost basis"
                  prefix="$"
                  min={0}
                  value={a.costBasis ?? a.balance}
                  hint="What you paid in; gains above it pay capital-gains tax when withdrawn."
                  onChange={(costBasis) => patch(a.id, { costBasis })}
                />
                <FireNumberField
                  label="Short-term gains"
                  suffix="%"
                  scale={100}
                  min={0}
                  max={1}
                  value={a.shortTermShare ?? 0}
                  hint="Share of gains held a year or less (active trading). Taxed as income."
                  onChange={(shortTermShare) => patch(a.id, { shortTermShare })}
                />
              </>
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
        Returns are nominal (before inflation); the plan adds {fmtPct(doc.settings.inflation, 1)} inflation on top. To use a real
        return, enter (1 + real) × (1 + inflation) − 1: 5% real is{" "}
        {fmtPct(nominalRate(0.05, doc.settings.inflation), 2)} here.
      </p>
    </div>
  )
}

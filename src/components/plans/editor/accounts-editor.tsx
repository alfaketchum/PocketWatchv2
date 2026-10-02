"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import { ACCOUNT_EVENTS, AddAccountDialog } from "./add-account-dialog"
import type { TemplateKey } from "@/lib/plans/milestone-templates"
import { fmtPct } from "@/components/fire/fire-helpers"
import { nominalRate } from "@/lib/plans/plan-dollars"
import { PLAN_LIMITS, TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, TaxTreatment } from "@/lib/plans/plan-types"
import { removeAccount } from "@/lib/plans/plan-edits"
import { patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { ReturnBasisToggle } from "./return-basis-toggle"
import { otherReturn, returnBasisOf, shownReturn, storedReturn } from "@/lib/plans/plan-returns"
import { AddButton, EditorToolbar, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { PlanNewSources } from "./plan-new-sources"
import { RefreshBalancesButton } from "./refresh-balances-button"
import { AccountsTable } from "./accounts-table"
import { accountOwner, ownTraditional } from "@/lib/plans/tax/retirement-rules-2026"

const TREATMENT_OPTIONS = (Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((value) => ({
  value,
  label: TAX_TREATMENT_LABELS[value],
}))

/** Accounts: balances at plan start, tax bucket, and expected return. */
export function AccountsEditor({ doc, update, view, onEditItem, viewToggle, planCreatedAt }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanAccount>) =>
    update((d) => ({ ...d, accounts: patchItem(d.accounts, id, change) }))

  const { isBasic } = usePlanMode()
  const [adding, setAdding] = useState(false)
  const [event, setEvent] = useState<TemplateKey | null>(null)

  return (
    <div className="space-y-3">
      {adding && (
        <AddAccountDialog
          doc={doc}
          update={update}
          onClose={() => setAdding(false)}
          onEvent={(key) => {
            setAdding(false)
            setEvent(key)
          }}
        />
      )}
      {event && (
        <AddMilestoneDialog
          doc={doc}
          update={update}
          initial={event}
          keys={ACCOUNT_EVENTS.map((t) => t.key)}
          title="Add a life event"
          onClose={() => setEvent(null)}
        />
      )}
      <EditorToolbar toggle={viewToggle}>
        <AddButton label="Add account" disabled={doc.accounts.length >= PLAN_LIMITS.accounts} onClick={() => setAdding(true)} />
      </EditorToolbar>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RefreshBalancesButton doc={doc} update={update} />
        {!isBasic && <ReturnBasisToggle doc={doc} update={update} />}
      </div>
      <PlanNewSources doc={doc} update={update} planCreatedAt={planCreatedAt} show="account" />
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
              value={shownReturn(a.returnRate, doc.settings)}
              hint={`≈ ${fmtPct(otherReturn(a.returnRate, doc.settings).value, 1)} ${otherReturn(a.returnRate, doc.settings).label}`}
              onChange={(v) => patch(a.id, { returnRate: storedReturn(v, doc.settings) })}
            />
            {ownTraditional(a) && doc.people.length > 1 && (
              <SelectField
                label="Owner"
                value={accountOwner(a, doc)?.id ?? ""}
                options={doc.people.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(owner) => patch(a.id, { owner })}
              />
            )}
            {!isBasic && a.drainByYear != null && (
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
            {!isBasic && a.taxTreatment === "taxable" && (
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
                <FireNumberField
                  label="Realized each year"
                  suffix="%"
                  scale={100}
                  min={0}
                  max={1}
                  value={a.realizedShare ?? 0}
                  hint="Share of each year's growth you sell (trading). Taxed that year, not at withdrawal. 0% = buy and hold."
                  onChange={(realizedShare) => patch(a.id, { realizedShare })}
                />
              </>
            )}
          </div>
        </ItemCard>
      ))}
      {!isBasic && (
        <p className="text-[11px] text-foreground-muted">
          {returnBasisOf(doc.settings) === "real"
            ? `Returns are after inflation: what your money grows in buying power. The plan adds ${fmtPct(doc.settings.inflation, 1)} inflation on top (5% real is ${fmtPct(nominalRate(0.05, doc.settings.inflation), 2)} before inflation), and they stay put if you change inflation.`
            : `Returns are before inflation, as usually quoted. The plan takes ${fmtPct(doc.settings.inflation, 1)} inflation off to see what they buy (${fmtPct(nominalRate(0.05, doc.settings.inflation), 2)} here is 5% after inflation). Prefer to think after inflation? Switch "Returns are" above.`}
        </p>
      )}
    </div>
  )
}

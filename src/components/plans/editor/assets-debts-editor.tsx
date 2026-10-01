"use client"

import { useMemo, useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { AssetKind, DebtKind, PlanAsset, PlanDebt } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { AddButton, EditorToolbar, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { AssetsDebtsTable } from "./assets-debts-table"
import { AssetFinancingFields } from "./asset-financing-fields"
import { AssetRunningCostsFields } from "./asset-running-costs-fields"
import { AssetHomeFields } from "./asset-home-fields"
import { PlanLoanSuggestions } from "./plan-loan-suggestions"
import { AddAssetDialog } from "./add-asset-dialog"
import { VehicleValueFields } from "./vehicle-value-fields"
import { typicalRunningCosts } from "@/lib/plans/plan-asset-costs"
import { removeAsset } from "@/lib/plans/plan-edits"
import { generatedDebts } from "@/lib/plans/plan-expand"
import { Badge } from "./plan-table"

const ASSET_KINDS: { value: AssetKind; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
]

const DEBT_KINDS: { value: DebtKind; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "student", label: "Student loan" },
  { value: "auto", label: "Auto loan" },
  { value: "credit", label: "Credit card" },
  { value: "other", label: "Other" },
]

const NO_ASSET = "none"

const ACQUIRED: { value: "purchase" | "received"; label: string }[] = [
  { value: "purchase", label: "Bought (paid from cash flow)" },
  { value: "received", label: "Inherited or gifted (no cost)" },
]

/** "Add asset" opens a pop-out asking what it is: owned now, or a home or vehicle to buy later. */
function AddAssetButton({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <AddButton label="Add asset" disabled={doc.assets.length >= PLAN_LIMITS.assets} onClick={() => setOpen(true)} />
      {open && <AddAssetDialog doc={doc} update={update} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Switching kind swaps in the new kind's typical costs, unless the costs were already changed by hand. */
function kindChange(a: PlanAsset, kind: AssetKind, state: string | null): Partial<PlanAsset> {
  const costs = a.runningCosts ?? []
  const untouched = costs.length === 0 || JSON.stringify(costs) === JSON.stringify(typicalRunningCosts(a.kind, state))
  return {
    kind,
    ...(kind === "vehicle" && a.vehicleAge === undefined ? { vehicleAge: 0 } : {}),
    ...(kind !== "vehicle" ? { vehicleAge: undefined } : {}),
    ...(untouched ? { runningCosts: typicalRunningCosts(kind, state) } : {}),
  }
}

function newDebt(): PlanDebt {
  return {
    id: newItemId("debt"),
    name: "Mortgage",
    kind: "mortgage",
    balance: 300_000,
    rate: 0.06,
    monthlyPayment: 1_800,
    start: { type: "planStart" },
    assetId: null,
    source: null,
  }
}

function AssetsList({ doc, update }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanAsset>) => update((d) => ({ ...d, assets: patchItem(d.assets, id, change) }))
  const remove = (id: string) =>
    update((d) => removeAsset(d, id))
  return (
    <InputBlock
      title="Assets"
      description="A home or car you own now, buy or inherit later, or sell. Sales pay capital-gains tax on the gain over cost basis; a home you live in gets the $250k/$500k exclusion after 2 years."
    >
      {doc.assets.length === 0 && <EmptyNote>No assets yet.</EmptyNote>}
      {doc.assets.map((a) => (
        <ItemCard key={a.id} anchorId={planItemAnchor(a.id)} title={a.name || "Untitled asset"} removeLabel={`Remove ${a.name}`} onRemove={() => remove(a.id)}>
          <div className={`grid grid-cols-2 ${a.kind === "vehicle" ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-2 items-end`}>
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={a.name} onChange={(name) => patch(a.id, { name })} />
            </div>
            <SelectField
              label="Type"
              value={a.kind}
              options={ASSET_KINDS}
              onChange={(kind) => patch(a.id, kindChange(a, kind, doc.settings.state))}
            />
            <FireNumberField label="Value today" prefix="$" min={0} value={a.value} onChange={(value) => patch(a.id, { value })} />
            {a.kind === "vehicle" ? (
              <VehicleValueFields
                vehicleAge={a.vehicleAge}
                appreciation={a.appreciation}
                later={a.start.type !== "planStart"}
                onChange={(change) => patch(a.id, change)}
              />
            ) : (
              <FireNumberField
                label="Value change / yr"
                suffix="%"
                scale={100}
                min={-0.5}
                max={1}
                value={a.appreciation}
                onChange={(appreciation) => patch(a.id, { appreciation })}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <SelectField
              label="How acquired"
              value={a.acquired ?? "purchase"}
              options={ACQUIRED}
              onChange={(acquired) => patch(a.id, { acquired })}
            />
            <FireNumberField
              label="Cost basis (for tax on sale)"
              prefix="$"
              min={0}
              value={a.costBasis ?? a.value}
              hint={a.costBasis == null ? "Default: its value when acquired (stepped-up if inherited)." : undefined}
              onChange={(costBasis) => patch(a.id, { costBasis })}
            />
          </div>
          {a.kind === "vehicle" && (
            <div className="grid grid-cols-2 gap-2 items-end">
              <FireNumberField
                label="Replace every (years)"
                min={0}
                max={50}
                value={a.replaceEveryYears ?? 0}
                hint="0 = keep it. Sold at its value then, and a like one bought at today's price plus inflation."
                onChange={(years) => patch(a.id, { replaceEveryYears: years >= 1 ? Math.round(years) : null })}
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TimingPicker label="Owned from" value={a.start} doc={doc} onChange={(start) => patch(a.id, { start })} />
            <TimingPicker
              label="Sold"
              value={a.end}
              doc={doc}
              allow={["planEnd", "age", "year", "milestone"]}
              onChange={(end) => patch(a.id, { end })}
            />
          </div>
          {a.kind === "home" && <AssetHomeFields asset={a} doc={doc} onChange={(change) => patch(a.id, change)} />}
          <AssetFinancingFields asset={a} doc={doc} onChange={(financing) => patch(a.id, { financing })} />
          <AssetRunningCostsFields asset={a} state={doc.settings.state} onChange={(runningCosts) => patch(a.id, { runningCosts })} />
        </ItemCard>
      ))}
    </InputBlock>
  )
}

function DebtsList({ doc, update }: PlanEditorProps) {
  const generated = useMemo(() => generatedDebts(doc), [doc])
  const patch = (id: string, change: Partial<PlanDebt>) => update((d) => ({ ...d, debts: patchItem(d.debts, id, change) }))
  const assetOptions = [{ value: NO_ASSET, label: "None" }, ...doc.assets.map((a) => ({ value: a.id, label: a.name }))]
  return (
    <InputBlock
      title="Debts"
      description="Paid monthly until the balance is gone. A loan linked to an asset is paid off from the sale when the asset is sold."
    >
      {doc.debts.length === 0 && generated.length === 0 && <EmptyNote>No debts.</EmptyNote>}
      {generated.length > 0 && (
        <div className="space-y-1 rounded-xl border border-card-border p-3">
          <p className="text-[11px] text-foreground-muted">From your financed purchases. Edit them on the asset&apos;s &ldquo;How you&apos;ll pay&rdquo;.</p>
          {generated.map(({ debt, assetId, year }) => (
            <button
              key={debt.id}
              type="button"
              onClick={() => assetId && document.getElementById(planItemAnchor(assetId))?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="flex w-full items-center gap-2 rounded-md -mx-1 px-1 py-0.5 text-left text-xs hover:bg-foreground/5"
            >
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }}>request_quote</span>
              <span className="text-foreground">{debt.name}</span>
              <span className="text-foreground-muted tabular-nums">
                {fmtMoney(debt.balance)} at {(debt.rate * 100).toFixed(2)}% · {fmtMoney(debt.monthlyPayment)}/mo
                {year !== null && ` · from ${year} (${year} dollars)`}
              </span>
              <Badge>From asset</Badge>
              <span className="ml-auto text-[11px] text-primary">Edit on the asset →</span>
            </button>
          ))}
        </div>
      )}
      {doc.debts.map((debt) => (
        <ItemCard
          key={debt.id} anchorId={planItemAnchor(debt.id)}
          title={debt.name || "Untitled debt"}
          removeLabel={`Remove ${debt.name}`}
          onRemove={() => update((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== debt.id) }))}
        >
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 items-end">
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={debt.name} onChange={(name) => patch(debt.id, { name })} />
            </div>
            <SelectField label="Type" value={debt.kind} options={DEBT_KINDS} onChange={(kind) => patch(debt.id, { kind })} />
            <FireNumberField label="Balance" prefix="$" min={0} value={debt.balance} onChange={(balance) => patch(debt.id, { balance })} />
            <FireNumberField label="Interest" suffix="%" scale={100} min={0} max={1} value={debt.rate} onChange={(rate) => patch(debt.id, { rate })} />
            <FireNumberField
              label="Monthly payment"
              prefix="$"
              min={0}
              value={debt.monthlyPayment}
              onChange={(monthlyPayment) => patch(debt.id, { monthlyPayment })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TimingPicker label="Starts" value={debt.start} doc={doc} onChange={(start) => patch(debt.id, { start })} />
            {doc.assets.length > 0 && (
              <SelectField
                label="Finances asset"
                value={debt.assetId ?? NO_ASSET}
                options={assetOptions}
                onChange={(v) => patch(debt.id, { assetId: v === NO_ASSET ? null : v })}
              />
            )}
          </div>
          {debt.balance > 0 && debt.monthlyPayment <= (debt.balance * debt.rate) / 12 && (
            <p className="text-[11px] text-warning">This payment doesn&apos;t cover the interest, so the balance grows.</p>
          )}
        </ItemCard>
      ))}
    </InputBlock>
  )
}

/** Homes, vehicles and the loans against them. */
export function AssetsDebtsEditor(props: PlanEditorProps) {
  const { doc, update } = props
  const toolbar = (
    <EditorToolbar toggle={props.viewToggle}>
      <AddAssetButton doc={doc} update={update} />
      <AddButton
        label="Add debt"
        disabled={doc.debts.length >= PLAN_LIMITS.debts}
        onClick={() => update((d) => ({ ...d, debts: [...d.debts, newDebt()] }))}
      />
    </EditorToolbar>
  )
  if (props.view === "compact") {
    return (
      <div className="space-y-3">
        {toolbar}
        <PlanLoanSuggestions doc={doc} update={update} />
        <AssetsDebtsTable {...props} />
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {toolbar}
      <PlanLoanSuggestions doc={doc} update={update} />
      <AssetsList {...props} />
      <DebtsList {...props} />
    </div>
  )
}

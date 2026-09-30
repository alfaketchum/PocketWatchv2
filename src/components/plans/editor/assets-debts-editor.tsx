"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { AssetKind, DebtKind, PlanAsset, PlanDebt } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { AddButton, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { AssetsDebtsTable } from "./assets-debts-table"
import { AssetFinancingFields } from "./asset-financing-fields"
import { removeAsset } from "@/lib/plans/plan-edits"

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
/** Typical yearly value loss for a car, applied when an asset is switched to "Vehicle". */
const VEHICLE_DEPRECIATION = -0.15

function newAsset(): PlanAsset {
  return {
    id: newItemId("asset"),
    name: "Home",
    kind: "home",
    value: 400_000,
    appreciation: 0.03,
    start: { type: "planStart" },
    end: { type: "planEnd" },
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
      description="A home or car you own now, buy or inherit later, or sell. Sales pay capital-gains tax on the gain over cost basis; homes get the $250k/$500k exclusion after 2 years."
    >
      {doc.assets.length === 0 && <EmptyNote>No assets yet.</EmptyNote>}
      {doc.assets.map((a) => (
        <ItemCard key={a.id} anchorId={planItemAnchor(a.id)} title={a.name || "Untitled asset"} removeLabel={`Remove ${a.name}`} onRemove={() => remove(a.id)}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={a.name} onChange={(name) => patch(a.id, { name })} />
            </div>
            <SelectField
              label="Type"
              value={a.kind}
              options={ASSET_KINDS}
              onChange={(kind) =>
                patch(a.id, kind === "vehicle" && a.appreciation >= 0 ? { kind, appreciation: VEHICLE_DEPRECIATION } : { kind })
              }
            />
            <FireNumberField label="Value today" prefix="$" min={0} value={a.value} onChange={(value) => patch(a.id, { value })} />
            <FireNumberField
              label="Value change / yr"
              suffix="%"
              scale={100}
              min={-0.5}
              max={1}
              value={a.appreciation}
              onChange={(appreciation) => patch(a.id, { appreciation })}
            />
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
          <AssetFinancingFields asset={a} doc={doc} onChange={(financing) => patch(a.id, { financing })} />
        </ItemCard>
      ))}
      <AddButton
        label="Add asset"
        disabled={doc.assets.length >= PLAN_LIMITS.assets}
        onClick={() => update((d) => ({ ...d, assets: [...d.assets, newAsset()] }))}
      />
    </InputBlock>
  )
}

function DebtsList({ doc, update }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanDebt>) => update((d) => ({ ...d, debts: patchItem(d.debts, id, change) }))
  const assetOptions = [{ value: NO_ASSET, label: "None" }, ...doc.assets.map((a) => ({ value: a.id, label: a.name }))]
  return (
    <InputBlock
      title="Debts"
      description="Paid monthly until the balance is gone. A loan linked to an asset is paid off from the sale when the asset is sold."
    >
      {doc.debts.length === 0 && <EmptyNote>No debts.</EmptyNote>}
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
      <AddButton
        label="Add debt"
        disabled={doc.debts.length >= PLAN_LIMITS.debts}
        onClick={() => update((d) => ({ ...d, debts: [...d.debts, newDebt()] }))}
      />
    </InputBlock>
  )
}

/** Homes, vehicles and the loans against them. */
export function AssetsDebtsEditor(props: PlanEditorProps) {
  const { doc, update } = props
  if (props.view === "compact") {
    return (
      <div className="space-y-3">
        <AssetsDebtsTable {...props} />
        <div className="flex flex-wrap gap-2">
          <AddButton
            label="Add asset"
            disabled={doc.assets.length >= PLAN_LIMITS.assets}
            onClick={() => update((d) => ({ ...d, assets: [...d.assets, newAsset()] }))}
          />
          <AddButton
            label="Add debt"
            disabled={doc.debts.length >= PLAN_LIMITS.debts}
            onClick={() => update((d) => ({ ...d, debts: [...d.debts, newDebt()] }))}
          />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <AssetsList {...props} />
      <DebtsList {...props} />
    </div>
  )
}

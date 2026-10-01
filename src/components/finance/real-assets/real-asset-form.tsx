"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { SelectField, TextField } from "@/components/plans/editor/plan-editor-controls"
import type { RealAssetInput, RealAssetItem, RealAssetLoan } from "@/hooks/finance/use-real-assets"
import { TYPICAL_APPRECIATION, type RealAssetKind } from "@/lib/finance/real-assets"
import { HomeLookupFields } from "./home-lookup-fields"

const KIND_OPTIONS: { value: RealAssetKind; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
]
const DEFAULT_NAMES: Record<RealAssetKind, string> = { home: "Home", vehicle: "Car", other: "Asset" }
const NO_LOAN = "none"

function draftFrom(asset: RealAssetItem | null, kind: RealAssetKind): RealAssetInput {
  if (!asset) return { kind, name: DEFAULT_NAMES[kind], value: 0, appreciation: TYPICAL_APPRECIATION[kind], purchasePrice: null, purchaseDate: null, loanAccountId: null }
  return {
    kind: asset.kind,
    name: asset.name,
    value: Math.round(asset.estimatedValue),
    appreciation: asset.appreciation,
    purchasePrice: asset.purchasePrice,
    purchaseDate: asset.purchaseDate?.slice(0, 10) ?? null,
    loanAccountId: asset.loanAccountId,
    address: asset.address,
    propertyTaxAnnual: asset.propertyTaxAnnual,
    rentEstimate: asset.rentEstimate,
    homeDetails: asset.homeDetails,
    dataSource: asset.dataSource,
    dataAsOf: asset.dataAsOf?.slice(0, 10) ?? null,
  }
}

/** Add or edit a home, vehicle or other asset. Saving a new value records it for today. */
export function RealAssetForm({
  asset,
  kind = "home",
  loans,
  saving,
  onSave,
  onCancel,
}: {
  asset: RealAssetItem | null
  /** Type of a new asset (picked before the form opens). */
  kind?: RealAssetKind
  loans: RealAssetLoan[]
  saving: boolean
  /** A value left as estimated is omitted, so only a value you enter is recorded. */
  onSave: (input: Partial<RealAssetInput>) => void
  onCancel: () => void
}) {
  const [initial] = useState<RealAssetInput>(() => draftFrom(asset, kind))
  const [d, setD] = useState<RealAssetInput>(initial)
  const set = (change: Partial<RealAssetInput>) => setD((cur) => ({ ...cur, ...change }))
  const changeKind = (kind: RealAssetKind) =>
    set({ kind, appreciation: TYPICAL_APPRECIATION[kind], ...(d.name === DEFAULT_NAMES[d.kind] ? { name: DEFAULT_NAMES[kind] } : {}) })
  const loanOptions = [{ value: NO_LOAN, label: "None" }, ...loans.map((l) => ({ value: l.id, label: l.name }))]

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const { value, ...rest } = d
        onSave(asset && value === initial.value ? rest : d)
      }}
    >
      {d.kind === "home" && <HomeLookupFields draft={d} onApply={set} />}
      <div className="grid grid-cols-2 gap-2 items-end">
        <SelectField label="Type" value={d.kind} options={KIND_OPTIONS} onChange={changeKind} />
        <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
        <FireNumberField label="Worth today" prefix="$" min={0} value={d.value} onChange={(value) => set({ value })} />
        <FireNumberField
          label="Value change / yr"
          suffix="%"
          scale={100}
          min={-0.5}
          max={1}
          value={d.appreciation}
          hint="Used between your updates"
          onChange={(appreciation) => set({ appreciation })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <FireNumberField label="Paid (optional)" prefix="$" min={0} value={d.purchasePrice ?? 0} onChange={(v) => set({ purchasePrice: v > 0 ? v : null })} />
        <label className="block">
          <span className="block text-[11px] font-medium text-foreground-muted mb-1">Bought on (optional)</span>
          <input
            type="date"
            value={d.purchaseDate ?? ""}
            onChange={(e) => set({ purchaseDate: e.target.value || null })}
            className="w-full rounded-xl border border-card-border bg-background-secondary px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="col-span-2">
          <SelectField label="Paid with loan" value={d.loanAccountId ?? NO_LOAN} options={loanOptions} onChange={(v) => set({ loanAccountId: v === NO_LOAN ? null : v })} />
        </div>
      </div>
      <p className="text-[11px] text-foreground-muted">
        With a purchase date, net-worth history counts it from then; otherwise from today. Between updates its value moves by the yearly change.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs">
          Cancel
        </button>
        <button type="submit" disabled={saving || !d.name.trim()} className="btn-primary text-xs disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  )
}

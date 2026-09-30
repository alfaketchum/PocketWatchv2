"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { INHERITED_IRA_YEARS, type InheritedKind, type InheritedPart } from "@/lib/plans/milestone-templates"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { RowButton } from "./plan-table"
import { SelectField, TextField } from "./plan-editor-controls"

const KINDS: { value: InheritedKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "stocks", label: "Stocks & funds" },
  { value: "realEstate", label: "Real estate" },
  { value: "retirement", label: "Retirement account" },
]

/** How each kind is taxed (US federal), shown under its row. */
function taxNote(part: InheritedPart): string {
  switch (part.kind) {
    case "cash":
      return "Not taxed as income."
    case "stocks":
      return "Not taxed on arrival. Cost basis steps up to today's value, so only future gains are taxed."
    case "realEstate":
      return "Not taxed on arrival. Basis steps up; if sold, only appreciation after this is taxed (home exclusion after 2 years)."
    case "retirement":
      return part.roth
        ? `Must be emptied within ${INHERITED_IRA_YEARS} years; Roth withdrawals are tax-free.`
        : `Must be emptied within ${INHERITED_IRA_YEARS} years, evenly; every withdrawal is taxed as income.`
  }
}

const NEW_ACCOUNT = "new"

export const emptyPart = (kind: InheritedKind = "cash"): InheritedPart => ({ kind, amount: 0, label: "", accountId: null, roth: false })

/** The parts of an inheritance (any mix of kinds, each with its own amount) and a state tax rate. */
export function InheritanceFields({
  parts,
  stateTaxRate,
  doc,
  onChange,
}: {
  parts: InheritedPart[]
  stateTaxRate: number
  doc: PlanDocument
  onChange: (change: { parts?: InheritedPart[]; stateTaxRate?: number }) => void
}) {
  const taxable = doc.accounts.filter((a) => a.taxTreatment === "taxable")
  const accountOptions = [{ value: NEW_ACCOUNT, label: "New: Inherited brokerage" }, ...taxable.map((a) => ({ value: a.id, label: a.name }))]
  const set = (i: number, change: Partial<InheritedPart>) => onChange({ parts: parts.map((p, j) => (j === i ? { ...p, ...change } : p)) })

  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-card-border p-2.5">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <SelectField label="Kind" value={p.kind} options={KINDS} onChange={(kind) => set(i, { kind })} />
            <FireNumberField label={p.kind === "realEstate" ? "Value today" : "Amount (today's $)"} prefix="$" min={0} value={p.amount} onChange={(amount) => set(i, { amount })} />
            <RowButton icon="delete" label="Remove this part" danger onClick={() => onChange({ parts: parts.filter((_, j) => j !== i) })} />
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <TextField label="Name (optional)" value={p.label} maxLength={60} onChange={(label) => set(i, { label })} />
            {p.kind === "stocks" && (
              <SelectField
                label="Goes into"
                value={p.accountId ?? NEW_ACCOUNT}
                options={accountOptions}
                onChange={(v) => set(i, { accountId: v === NEW_ACCOUNT ? null : v })}
              />
            )}
            {p.kind === "retirement" && (
              <div className="pb-1.5">
                <Toggle label="Roth" checked={p.roth} onChange={(roth) => set(i, { roth })} />
              </div>
            )}
          </div>
          <p className="text-[11px] text-foreground-muted">{taxNote(p)}</p>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ parts: [...parts, emptyPart("stocks")] })} className="text-[11px] text-primary hover:underline">
        + Add another part
      </button>
      <FireNumberField
        label="State inheritance tax (0 for none)"
        suffix="%"
        scale={100}
        min={0}
        max={0.2}
        value={stateTaxRate}
        hint="Only a few states tax heirs (PA, NJ, KY, NE, MD). Federal estate tax is paid by the estate, not you."
        onChange={(v) => onChange({ stateTaxRate: v })}
      />
    </div>
  )
}

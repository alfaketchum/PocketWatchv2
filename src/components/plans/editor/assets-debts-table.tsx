"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import type { AssetKind, DebtKind, PlanAsset, PlanDebt } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { Cell, CellNumber, CellSelect, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

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

const ASSET_COLUMNS = [
  { label: "Asset" },
  { label: "Type", width: "w-28" },
  { label: "Value today", align: "right" as const, width: "w-36" },
  { label: "Change / yr", align: "right" as const, width: "w-28" },
  { label: "Owned from", width: "w-32" },
  { label: "Sold", width: "w-32" },
  { label: "", width: "w-16" },
]

const DEBT_COLUMNS = [
  { label: "Debt" },
  { label: "Type", width: "w-32" },
  { label: "Balance", align: "right" as const, width: "w-36" },
  { label: "Interest", align: "right" as const, width: "w-24" },
  { label: "Monthly", align: "right" as const, width: "w-32" },
  { label: "Starts", width: "w-28" },
  { label: "Finances", width: "w-32" },
  { label: "", width: "w-16" },
]

function Actions({ name, anchor, onEditItem, onRemove }: { name: string; anchor: string; onEditItem?: (id: string) => void; onRemove: () => void }) {
  return (
    <span className="flex">
      <RowButton icon="edit" label={`Edit ${name} in list view`} onClick={() => onEditItem?.(anchor)} />
      <RowButton icon="delete" label={`Remove ${name}`} danger onClick={onRemove} />
    </span>
  )
}

/** Assets and debts as two editable tables; timings open in list view. */
export function AssetsDebtsTable({ doc, update, onEditItem }: PlanEditorProps) {
  const patchAsset = (id: string, change: Partial<PlanAsset>) => update((d) => ({ ...d, assets: patchItem(d.assets, id, change) }))
  const patchDebt = (id: string, change: Partial<PlanDebt>) => update((d) => ({ ...d, debts: patchItem(d.debts, id, change) }))
  const assetName = (id: string | null) => doc.assets.find((a) => a.id === id)?.name ?? "—"
  return (
    <div className="space-y-5">
      <PlanTable
        columns={ASSET_COLUMNS}
        footer={
          <tr>
            <td className="px-2 py-2" colSpan={2}>
              Assets
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(doc.assets.reduce((s, a) => s + a.value, 0))}</td>
            <td colSpan={4} />
          </tr>
        }
      >
        {doc.assets.map((a) => (
          <Row key={a.id}>
            <Cell>
              <CellText label="Asset name" value={a.name} onChange={(name) => patchAsset(a.id, { name })} />
            </Cell>
            <Cell>
              <CellSelect label="Type" value={a.kind} options={ASSET_KINDS} onChange={(kind) => patchAsset(a.id, { kind })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Value" prefix="$" min={0} value={a.value} onChange={(value) => patchAsset(a.id, { value })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Value change" suffix="%" scale={100} min={-0.5} max={1} value={a.appreciation} onChange={(appreciation) => patchAsset(a.id, { appreciation })} />
            </Cell>
            <Cell>
              <TimingCell timing={a.start} doc={doc} />
            </Cell>
            <Cell>
              <TimingCell timing={a.end} doc={doc} />
            </Cell>
            <Cell align="center">
              <Actions
                name={a.name}
                anchor={planItemAnchor(a.id)}
                onEditItem={onEditItem}
                onRemove={() =>
                  update((d) => ({
                    ...d,
                    assets: d.assets.filter((x) => x.id !== a.id),
                    debts: d.debts.map((debt) => (debt.assetId === a.id ? { ...debt, assetId: null } : debt)),
                  }))
                }
              />
            </Cell>
          </Row>
        ))}
      </PlanTable>
      <PlanTable
        columns={DEBT_COLUMNS}
        footer={
          <tr>
            <td className="px-2 py-2" colSpan={2}>
              Debts
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(doc.debts.reduce((s, d) => s + d.balance, 0))}</td>
            <td />
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(doc.debts.reduce((s, d) => s + d.monthlyPayment, 0))}</td>
            <td colSpan={3} />
          </tr>
        }
      >
        {doc.debts.map((debt) => (
          <Row key={debt.id}>
            <Cell>
              <CellText label="Debt name" value={debt.name} onChange={(name) => patchDebt(debt.id, { name })} />
            </Cell>
            <Cell>
              <CellSelect label="Type" value={debt.kind} options={DEBT_KINDS} onChange={(kind) => patchDebt(debt.id, { kind })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Balance" prefix="$" min={0} value={debt.balance} onChange={(balance) => patchDebt(debt.id, { balance })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Interest" suffix="%" scale={100} min={0} max={1} value={debt.rate} onChange={(rate) => patchDebt(debt.id, { rate })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Monthly payment" prefix="$" min={0} value={debt.monthlyPayment} onChange={(monthlyPayment) => patchDebt(debt.id, { monthlyPayment })} />
            </Cell>
            <Cell>
              <TimingCell timing={debt.start} doc={doc} />
            </Cell>
            <Cell>
              <span className="block truncate px-2 text-xs text-foreground-muted">{assetName(debt.assetId)}</span>
            </Cell>
            <Cell align="center">
              <Actions
                name={debt.name}
                anchor={planItemAnchor(debt.id)}
                onEditItem={onEditItem}
                onRemove={() => update((d) => ({ ...d, debts: d.debts.filter((x) => x.id !== debt.id) }))}
              />
            </Cell>
          </Row>
        ))}
      </PlanTable>
    </div>
  )
}

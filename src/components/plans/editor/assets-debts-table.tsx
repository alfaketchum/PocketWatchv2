"use client"

import { useMemo, useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import type { AssetKind, PlanAsset, PlanDebt } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { Badge, Cell, CellNumber, CellSelect, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"
import { paidWithLabel } from "@/lib/plans/plan-financing"
import { removeAsset } from "@/lib/plans/plan-edits"
import { generatedDebts } from "@/lib/plans/plan-expand"
import { scheduledPayment } from "@/lib/plans/plan-debt-payments"
import { DEBT_KINDS, withDebtKind } from "./debt-constants"
import { LoanScheduleDialog } from "./loan-schedule-lazy"

const ASSET_KINDS: { value: AssetKind; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
]

const ASSET_COLUMNS = [
  { label: "Asset" },
  { label: "Type", width: "w-28" },
  { label: "Value today", align: "right" as const, width: "w-36" },
  { label: "Change / yr", align: "right" as const, width: "w-28" },
  { label: "Owned from", width: "w-32" },
  { label: "Sold", width: "w-32" },
  { label: "Paid with", width: "w-32" },
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
  { label: "", width: "w-24" },
]

function Actions({
  name,
  anchor,
  onEditItem,
  onRemove,
  onSchedule,
}: {
  name: string
  anchor: string
  onEditItem?: (id: string) => void
  onRemove: () => void
  onSchedule?: () => void
}) {
  return (
    <span className="flex">
      {onSchedule && <RowButton icon="table_chart" label={`See the amortization schedule for ${name}`} onClick={onSchedule} />}
      <RowButton icon="edit" label={`Edit ${name} in detailed view`} onClick={() => onEditItem?.(anchor)} />
      <RowButton icon="delete" label={`Remove ${name}`} danger onClick={onRemove} />
    </span>
  )
}

/** Assets and debts as two editable tables; timings open in detailed view. */
export function AssetsDebtsTable({ doc, update, onEditItem }: PlanEditorProps) {
  const patchAsset = (id: string, change: Partial<PlanAsset>) => update((d) => ({ ...d, assets: patchItem(d.assets, id, change) }))
  const patchDebt = (id: string, change: Partial<PlanDebt>) => update((d) => ({ ...d, debts: patchItem(d.debts, id, change) }))
  const assetName = (id: string | null) => doc.assets.find((a) => a.id === id)?.name ?? "—"
  // Loans from financed purchases: listed read-only, edited on their asset.
  const generated = useMemo(() => generatedDebts(doc), [doc])
  const [scheduleId, setScheduleId] = useState<string | null>(null)
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
            <td colSpan={5} />
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
              {a.kind === "vehicle" && a.vehicleAge !== undefined ? (
                <span className="block truncate px-2 text-xs text-foreground-muted" title="Typical depreciation for its age; change it in the detailed view">
                  By age ({a.vehicleAge} yr{a.vehicleAge === 1 ? "" : "s"})
                </span>
              ) : (
                <CellNumber label="Value change" suffix="%" scale={100} min={-0.5} max={1} value={a.appreciation} onChange={(appreciation) => patchAsset(a.id, { appreciation })} />
              )}
            </Cell>
            <Cell>
              <TimingCell timing={a.start} doc={doc} />
            </Cell>
            <Cell>
              {a.replaceEveryYears ? (
                <span className="block truncate px-2 text-xs text-foreground-muted">Replaced every {a.replaceEveryYears} yrs</span>
              ) : (
                <TimingCell timing={a.end} doc={doc} />
              )}
            </Cell>
            <Cell>
              <span className="block truncate px-2 text-xs text-foreground-muted">{paidWithLabel(a, doc)}</span>
            </Cell>
            <Cell align="center">
              <Actions
                name={a.name}
                anchor={planItemAnchor(a.id)}
                onEditItem={onEditItem}
                onRemove={() => update((d) => removeAsset(d, a.id))}
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
            <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(doc.debts.reduce((s, d) => s + scheduledPayment(d, 0), 0))}</td>
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
              <CellSelect label="Type" value={debt.kind} options={DEBT_KINDS} onChange={(kind) => patchDebt(debt.id, withDebtKind(debt, kind, doc))} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Balance" prefix="$" min={0} value={debt.balance} onChange={(balance) => patchDebt(debt.id, { balance })} />
            </Cell>
            <Cell align="right">
              <CellNumber label="Interest" suffix="%" scale={100} min={0} max={1} value={debt.rate} onChange={(rate) => patchDebt(debt.id, { rate })} />
            </Cell>
            <Cell align="right">
              {debt.kind === "heloc" ? (
                <span className="block px-2 tabular-nums" title="Interest only during the draw period, then paid down; change the terms in the detailed view">
                  {fmtMoney(scheduledPayment(debt, 0))}
                </span>
              ) : (
                <CellNumber label="Monthly payment" prefix="$" min={0} value={debt.monthlyPayment} onChange={(monthlyPayment) => patchDebt(debt.id, { monthlyPayment })} />
              )}
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
                onSchedule={() => setScheduleId(debt.id)}
              />
            </Cell>
          </Row>
        ))}
        {generated.map(({ debt, assetId, year }) => (
          <Row key={debt.id} muted>
            <Cell>
              <span className="flex items-center px-2">
                {debt.name}
                <Badge>From asset</Badge>
              </span>
            </Cell>
            <Cell>
              <span className="px-2 text-xs">{DEBT_KINDS.find((k) => k.value === debt.kind)?.label ?? debt.kind}</span>
            </Cell>
            <Cell align="right">
              <span className="px-2 tabular-nums" title={year !== null ? `Borrowed in ${year}, in ${year} dollars` : undefined}>{fmtMoney(debt.balance)}</span>
            </Cell>
            <Cell align="right">
              <span className="px-2 tabular-nums">{(debt.rate * 100).toFixed(2)}%</span>
            </Cell>
            <Cell align="right">
              <span className="px-2 tabular-nums">{fmtMoney(debt.monthlyPayment)}</span>
            </Cell>
            <Cell>
              <TimingCell timing={debt.start} doc={doc} />
            </Cell>
            <Cell>
              <span className="block truncate px-2 text-xs text-foreground-muted">{assetName(assetId)}</span>
            </Cell>
            <Cell align="center">
              <span className="flex">
                <RowButton icon="table_chart" label={`See the amortization schedule for ${debt.name}`} onClick={() => setScheduleId(debt.id)} />
                {assetId && <RowButton icon="edit" label={`Edit the financing on ${assetName(assetId)}`} onClick={() => onEditItem?.(planItemAnchor(assetId))} />}
              </span>
            </Cell>
          </Row>
        ))}
      </PlanTable>
      {scheduleId && <LoanScheduleDialog doc={doc} debtId={scheduleId} onClose={() => setScheduleId(null)} />}
    </div>
  )
}

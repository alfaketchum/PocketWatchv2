"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, TaxTreatment } from "@/lib/plans/plan-types"
import { patchItem, removeAccount, type PlanEditorProps } from "../plans-helpers"
import { Cell, CellNumber, CellSelect, CellText, PlanTable, Row, RowButton } from "./plan-table"

const TREATMENTS = (Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((value) => ({ value, label: TAX_TREATMENT_LABELS[value] }))

const COLUMNS = [
  { label: "Account" },
  { label: "Tax type", width: "w-44" },
  { label: "Balance today", align: "right" as const, width: "w-36" },
  { label: "Return / yr", align: "right" as const, width: "w-28" },
  { label: "Cost basis", align: "right" as const, width: "w-36" },
  { label: "", width: "w-10" },
]

/** Accounts as an editable table. */
export function AccountsTable({ doc, update }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanAccount>) => update((d) => ({ ...d, accounts: patchItem(d.accounts, id, change) }))
  const total = doc.accounts.reduce((s, a) => s + a.balance, 0)
  return (
    <PlanTable
      columns={COLUMNS}
      footer={
        <tr>
          <td className="px-2 py-2" colSpan={2}>
            {doc.accounts.length} accounts
          </td>
          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(total)}</td>
          <td colSpan={3} />
        </tr>
      }
    >
      {doc.accounts.map((a) => (
        <Row key={a.id}>
          <Cell>
            <CellText label="Account name" value={a.name} onChange={(name) => patch(a.id, { name })} />
          </Cell>
          <Cell>
            <CellSelect label="Tax type" value={a.taxTreatment} options={TREATMENTS} onChange={(taxTreatment) => patch(a.id, { taxTreatment })} />
          </Cell>
          <Cell align="right">
            <CellNumber label="Balance" prefix="$" min={0} value={a.balance} onChange={(balance) => patch(a.id, { balance })} />
          </Cell>
          <Cell align="right">
            <CellNumber label="Return" suffix="%" scale={100} min={-0.5} max={1} value={a.returnRate} onChange={(returnRate) => patch(a.id, { returnRate })} />
          </Cell>
          <Cell align="right">
            {a.taxTreatment === "taxable" ? (
              <CellNumber label="Cost basis" prefix="$" min={0} value={a.costBasis ?? a.balance} onChange={(costBasis) => patch(a.id, { costBasis })} />
            ) : (
              <span className="px-2 text-foreground-muted">—</span>
            )}
          </Cell>
          <Cell align="center">
            <RowButton icon="delete" label={`Remove ${a.name}`} danger onClick={() => update((d) => removeAccount(d, a.id))} />
          </Cell>
        </Row>
      ))}
    </PlanTable>
  )
}

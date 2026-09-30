"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { childExpenses } from "@/lib/plans/plan-children"
import type { PlanExpense } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { Badge, Cell, CellCheck, CellNumber, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

const COLUMNS = [
  { label: "Expense" },
  { label: "Per year", align: "right" as const, width: "w-32" },
  { label: "Grows / yr", align: "right" as const, width: "w-28" },
  { label: "Starts", width: "w-32" },
  { label: "Stops", width: "w-32" },
  { label: "Once", align: "center" as const, width: "w-14" },
  { label: "", width: "w-16" },
]

/** Expenses as an editable table, with kids' generated lines shown read-only. */
export function ExpensesTable({ doc, update, onEditItem }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanExpense>) => update((d) => ({ ...d, expenses: patchItem(d.expenses, id, change) }))
  const kidLines = (doc.children ?? []).flatMap((child) =>
    childExpenses({ ...doc, children: [child] }).map((expense) => ({ expense, childId: child.id })),
  )
  const today = doc.expenses.filter((e) => !e.oneTime && e.start.type === "planStart").reduce((s, e) => s + e.amount, 0)
  return (
    <PlanTable
      columns={COLUMNS}
      footer={
        <tr>
          <td className="px-2 py-2">Spending today (excl. kids)</td>
          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today)}</td>
          <td colSpan={5} />
        </tr>
      }
    >
      {doc.expenses.map((e) => (
        <Row key={e.id}>
          <Cell>
            <CellText label="Expense name" value={e.name} onChange={(name) => patch(e.id, { name })} />
          </Cell>
          <Cell align="right">
            <CellNumber label="Per year" prefix="$" min={0} value={e.amount} onChange={(amount) => patch(e.id, { amount })} />
          </Cell>
          <Cell align="right">
            <CellNumber
              label="Growth"
              suffix={e.growth === null ? "% infl." : "%"}
              scale={100}
              min={-0.5}
              max={1}
              value={e.growth ?? doc.settings.inflation}
              onChange={(growth) => patch(e.id, { growth })}
            />
          </Cell>
          <Cell>
            <TimingCell timing={e.start} doc={doc} />
          </Cell>
          <Cell>{e.oneTime ? <span className="px-2 text-foreground-muted">—</span> : <TimingCell timing={e.end} doc={doc} />}</Cell>
          <Cell align="center">
            <CellCheck label="One-time" checked={e.oneTime} onChange={(oneTime) => patch(e.id, { oneTime })} />
          </Cell>
          <Cell align="center">
            <span className="flex">
              <RowButton icon="edit" label={`Edit ${e.name} in detailed view`} onClick={() => onEditItem?.(planItemAnchor(e.id))} />
              <RowButton
                icon="delete"
                label={`Remove ${e.name}`}
                danger
                onClick={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}
              />
            </span>
          </Cell>
        </Row>
      ))}
      {kidLines.map(({ expense: e, childId }) => (
        <Row key={e.id} muted>
          <Cell>
            <span className="flex items-center px-2">
              {e.name}
              <Badge>Kids</Badge>
            </span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{fmtMoney(e.amount)}</span>
          </Cell>
          <Cell align="right">
            <span className="px-2 tabular-nums">{e.growth === null ? "infl." : `${(e.growth * 100).toFixed(1)}%`}</span>
          </Cell>
          <Cell>
            <TimingCell timing={e.start} doc={doc} />
          </Cell>
          <Cell>
            <TimingCell timing={e.end} doc={doc} />
          </Cell>
          <Cell />
          <Cell align="center">
            <RowButton icon="edit" label="Edit this child in detailed view" onClick={() => onEditItem?.(planItemAnchor(childId))} />
          </Cell>
        </Row>
      ))}
    </PlanTable>
  )
}

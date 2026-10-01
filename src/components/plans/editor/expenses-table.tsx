"use client"

import { useMemo, useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { childExpenses } from "@/lib/plans/plan-children"
import { overlapWarning, retirementAge } from "@/lib/plans/plan-spending-patterns"
import type { PlanExpense } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { PatternChips } from "./expense-pattern-field"
import { Badge, Cell, CellCheck, CellNumber, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"

const MONTHS = 12

type SortKey = "name" | "amount"
type Sort = { key: SortKey; dir: "asc" | "desc" } | null

/** Clicking a sortable header: amounts start highest first, names A–Z; a third click goes back to your order. */
function nextSort(current: Sort, key: SortKey): Sort {
  const first = key === "amount" ? "desc" : "asc"
  if (current?.key !== key) return { key, dir: first }
  return current.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null
}

/** Sorted for display only (the saved order is untouched). By amount, one-time costs follow the recurring lines. */
function sorted(expenses: PlanExpense[], sort: Sort): PlanExpense[] {
  if (!sort) return expenses
  const sign = sort.dir === "asc" ? 1 : -1
  return [...expenses].sort((a, b) => {
    if (sort.key === "name") return sign * a.name.localeCompare(b.name)
    if (a.oneTime !== b.oneTime) return a.oneTime ? 1 : -1
    return sign * (a.amount - b.amount)
  })
}

function columns(sort: Sort, setSort: (s: Sort) => void) {
  const by = (key: SortKey) => ({ sort: sort?.key === key ? sort.dir : null, onSort: () => setSort(nextSort(sort, key)) })
  return [
    { label: "Expense", ...by("name") },
    { label: "As you age", width: "w-[27rem]" },
    { label: "Per month", align: "right" as const, width: "w-28", ...by("amount") },
    { label: "Per year", align: "right" as const, width: "w-32", ...by("amount") },
    { label: "Grows / yr", align: "right" as const, width: "w-28" },
    { label: "Starts", width: "w-32" },
    { label: "Stops", width: "w-32" },
    { label: "Once", align: "center" as const, width: "w-14" },
    { label: "", width: "w-16" },
  ]
}

const Dash = () => <span className="px-2 text-foreground-muted">—</span>

/** Expenses as an editable table, with kids' generated lines shown read-only. */
export function ExpensesTable({ doc, update, onEditItem }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanExpense>) => update((d) => ({ ...d, expenses: patchItem(d.expenses, id, change) }))
  const kidLines = (doc.children ?? []).flatMap((child) =>
    childExpenses({ ...doc, children: [child] }).map((expense) => ({ expense, childId: child.id })),
  )
  const ages = useMemo(() => ({ now: primaryAge(doc), retire: retirementAge(doc) }), [doc])
  const [sort, setSort] = useState<Sort>(null)
  const today = doc.expenses.filter((e) => !e.oneTime && e.start.type === "planStart").reduce((s, e) => s + e.amount, 0)
  return (
    <PlanTable
      columns={columns(sort, setSort)}
      minWidth="min-w-[1080px]"
      footer={
        <tr>
          <td className="px-2 py-2">Spending today (excl. kids)</td>
          <td />
          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today / MONTHS)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today)}</td>
          <td colSpan={5} />
        </tr>
      }
    >
      {sorted(doc.expenses, sort).map((e) => (
        <Row key={e.id}>
          <Cell>
            <CellText label="Expense name" value={e.name} onChange={(name) => patch(e.id, { name })} />
          </Cell>
          <Cell>
            {e.oneTime ? (
              <Dash />
            ) : (
              <span className="block px-2">
                <PatternChips pattern={e.pattern} onChange={(pattern) => patch(e.id, { pattern })} fromAge={ages.now} retireAge={ages.retire} nowrap warning={overlapWarning(e, doc.settings.inflation)} />
              </span>
            )}
          </Cell>
          <Cell align="right">
            {e.oneTime ? (
              <Dash />
            ) : (
              <CellNumber label="Per month" prefix="$" min={0} value={e.amount / MONTHS} onChange={(monthly) => patch(e.id, { amount: monthly * MONTHS })} />
            )}
          </Cell>
          <Cell align="right">
            <CellNumber label={e.oneTime ? "Amount" : "Per year"} prefix="$" min={0} value={e.amount} onChange={(amount) => patch(e.id, { amount })} />
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
          <Cell>{e.oneTime ? <Dash /> : <TimingCell timing={e.end} doc={doc} />}</Cell>
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
          <Cell />
          <Cell align="right">
            <span className="px-2 tabular-nums">{fmtMoney(e.amount / MONTHS)}</span>
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

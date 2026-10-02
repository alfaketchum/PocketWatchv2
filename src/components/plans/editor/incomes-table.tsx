"use client"

import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import type { IncomeKind, PlanIncome } from "@/lib/plans/plan-types"
import { patchItem, planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { Badge, Cell, CellCheck, CellNumber, CellSelect, CellText, PlanTable, Row, RowButton } from "./plan-table"
import { TimingCell } from "./timing-cell"
import { socialSecurityYearly } from "@/lib/plans/ss-plan-earnings"

const KINDS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "business", label: "Business" },
  { value: "equity", label: "Stock pay" },
  { value: "social_security", label: "Social Security" },
  { value: "pension", label: "Pension" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
]

const COLUMNS = [
  { label: "Income" },
  { label: "Type", width: "w-36" },
  { label: "Per year", align: "right" as const, width: "w-32" },
  { label: "Grows / yr", align: "right" as const, width: "w-28", advanced: true },
  { label: "Starts", width: "w-28" },
  { label: "Stops", width: "w-28" },
  { label: "Taxed", align: "center" as const, width: "w-14" },
  { label: "Payroll", width: "w-36", advanced: true },
  { label: "", width: "w-16" },
]

function payrollSummary(income: PlanIncome, doc: PlanEditorProps["doc"]): string {
  if (income.contributions.length === 0) return "—"
  return income.contributions
    .map((c) => {
      const name = doc.accounts.find((a) => a.id === c.accountId)?.name ?? "?"
      return `${name} ${fmtPct(c.percent, 0)}${c.employerMatchPercent > 0 ? ` +${fmtPct(c.employerMatchPercent, 0)}` : ""}${c.discount ? ` (${fmtPct(c.discount, 0)} off)` : ""}`
    })
    .join(", ")
}

/** Income streams as an editable table; timings and payroll open in detailed view. */
export function IncomesTable({ doc, update, onEditItem }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanIncome>) => update((d) => ({ ...d, incomes: patchItem(d.incomes, id, change) }))
  const { isBasic } = usePlanMode()
  const today = doc.incomes.filter((i) => !i.oneTime && i.start.type === "planStart").reduce((s, i) => s + i.amount, 0)
  return (
    <PlanTable
      columns={isBasic ? COLUMNS.filter((c) => !c.advanced) : COLUMNS}
      footer={
        <tr>
          <td className="px-2 py-2" colSpan={2}>
            Income today
          </td>
          <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(today)}</td>
          <td colSpan={isBasic ? 4 : 6} />
        </tr>
      }
    >
      {doc.incomes.map((inc) => (
        <Row key={inc.id}>
          <Cell>
            <span className="flex items-center">
              <CellText label="Income name" value={inc.name} onChange={(name) => patch(inc.id, { name })} />
              {inc.oneTime && <Badge>Once</Badge>}
            </span>
          </Cell>
          <Cell>
            <CellSelect label="Type" value={inc.kind} options={KINDS} onChange={(kind) => patch(inc.id, { kind })} />
          </Cell>
          <Cell align="right">
            {inc.socialSecurity ? (
              <span className="block px-2 tabular-nums" title={`Claiming at ${inc.socialSecurity.claimAge}; change it in the detailed view`}>
                {fmtMoney(socialSecurityYearly(doc, inc))}
              </span>
            ) : inc.kind === "equity" && inc.equity ? (
              <span className="block px-2 tabular-nums" title="Shares × price; change them in the detailed view">
                {fmtMoney(inc.amount)}
              </span>
            ) : (
              <CellNumber label="Per year" prefix="$" min={0} value={inc.amount} onChange={(amount) => patch(inc.id, { amount })} />
            )}
          </Cell>
          {!isBasic && (
            <Cell align="right">
              {inc.socialSecurity ? (
                <span className="block px-2 text-xs text-foreground-muted">claim at {inc.socialSecurity.claimAge}</span>
              ) : (
                <CellNumber
                  label="Growth"
                  suffix={inc.growth === null ? "% infl." : inc.growth === 0 ? "% fixed" : "%"}
                  scale={100}
                  min={-0.5}
                  max={1}
                  value={inc.growth ?? doc.settings.inflation}
                  onChange={(growth) => patch(inc.id, { growth })}
                />
              )}
            </Cell>
          )}
          <Cell>
            <TimingCell timing={inc.start} doc={doc} />
          </Cell>
          <Cell>{inc.oneTime ? <span className="px-2 text-foreground-muted">—</span> : <TimingCell timing={inc.end} doc={doc} />}</Cell>
          <Cell align="center">
            <CellCheck label="Taxable" checked={inc.taxable} onChange={(taxable) => patch(inc.id, { taxable })} />
          </Cell>
          {!isBasic && (
            <Cell>
              <span className="block truncate px-2 text-xs text-foreground-muted">{payrollSummary(inc, doc)}</span>
            </Cell>
          )}
          <Cell align="center">
            <span className="flex">
              <RowButton icon="edit" label={`Edit ${inc.name} in detailed view`} onClick={() => onEditItem?.(planItemAnchor(inc.id))} />
              <RowButton
                icon="delete"
                label={`Remove ${inc.name}`}
                danger
                onClick={() => update((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== inc.id) }))}
              />
            </span>
          </Cell>
        </Row>
      ))}
    </PlanTable>
  )
}

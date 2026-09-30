"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"

function Cell({ value, tone }: { value: number; tone?: "neg" | "pos" }) {
  const shown = Math.abs(value) < 0.5 ? "—" : fmtMoney(value)
  return (
    <td
      className={cn(
        "px-3 py-2 text-right tabular-nums whitespace-nowrap",
        shown !== "—" && tone === "neg" && "text-error",
        shown !== "—" && tone === "pos" && "text-success",
      )}
    >
      {shown}
    </td>
  )
}

function DetailList({ title, entries }: { title: string; entries: { label: string; value: number }[] }) {
  const shown = entries.filter((e) => Math.abs(e.value) >= 0.5)
  if (shown.length === 0) return null
  return (
    <div className="min-w-[12rem]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-1">{title}</p>
      {shown.map((e) => (
        <p key={e.label} className="flex justify-between gap-4 text-xs">
          <span className="text-foreground-muted truncate">{e.label}</span>
          <span className="tabular-nums text-foreground">{fmtMoney(e.value)}</span>
        </p>
      ))}
    </div>
  )
}

function named<T extends { id: string; name: string }>(items: T[], values: Record<string, number>) {
  return items.map((i) => ({ label: i.name, value: values[i.id] ?? 0 }))
}

/** A ledger year; clicking it expands per-account and per-stream detail. */
export function PlanLedgerRow({
  row,
  doc,
  expanded,
  onToggle,
}: {
  row: YearRow
  doc: PlanDocument
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn("border-t border-card-border cursor-pointer hover:bg-row-hover", row.shortfall > 0.5 && "bg-error/5")}
      >
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="material-symbols-rounded align-middle text-foreground-muted mr-1" style={{ fontSize: 14 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
          {row.year}
        </td>
        <td className="px-3 py-2 tabular-nums">
          {row.ages.join(" / ")}
          {row.milestones.length > 0 && (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{row.milestones.join(", ")}</span>
          )}
        </td>
        <Cell value={row.income} />
        <Cell value={-(row.incomeTax + row.withdrawalTax)} tone="neg" />
        <Cell value={-row.expenses} tone="neg" />
        <Cell value={-row.debtPayments} tone="neg" />
        <Cell value={row.contributions} tone="pos" />
        <Cell value={-row.withdrawals} tone="neg" />
        <Cell value={row.netWorth} />
      </tr>
      {expanded && (
        <tr className="bg-background-secondary/40">
          <td colSpan={9} className="px-3 py-3">
            <div className="flex flex-wrap gap-6">
              <DetailList title="Year-end balances" entries={named(doc.accounts, row.balances)} />
              <DetailList title="Income" entries={named(doc.incomes, row.incomeBy)} />
              <DetailList title="Spending" entries={named(doc.expenses, row.expensesBy)} />
              <DetailList title="Saved into" entries={named(doc.accounts, row.contributionsBy)} />
              <DetailList title="Withdrawn from" entries={named(doc.accounts, row.withdrawalsBy)} />
              <DetailList
                title="Other"
                entries={[
                  { label: "Investment growth", value: row.growth },
                  { label: "Employer match", value: row.employerMatch },
                  { label: "Income tax", value: row.incomeTax },
                  { label: "Tax on withdrawals", value: row.withdrawalTax },
                  { label: "Asset purchases", value: row.assetPurchases },
                  { label: "Asset sales", value: row.assetSales },
                  { label: "Debt left", value: row.debtsTotal },
                  { label: "Shortfall", value: row.shortfall },
                ]}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

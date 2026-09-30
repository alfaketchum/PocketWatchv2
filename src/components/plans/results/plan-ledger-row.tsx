"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { PlanYearDetail } from "./plan-year-detail"

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
        <Cell value={-(row.incomeTax + row.withdrawalTax + row.saleTax + row.tradingTax)} tone="neg" />
        <Cell value={-row.expenses} tone="neg" />
        <Cell value={-row.debtPayments} tone="neg" />
        <Cell value={row.contributions - row.employerMatch} tone="pos" />
        <Cell value={-row.withdrawals} tone="neg" />
        <Cell value={row.netWorth} />
      </tr>
      {expanded && (
        <tr className="bg-background-secondary/40">
          <td colSpan={9} className="px-3 py-3">
            <PlanYearDetail row={row} doc={doc} />
          </td>
        </tr>
      )}
    </>
  )
}

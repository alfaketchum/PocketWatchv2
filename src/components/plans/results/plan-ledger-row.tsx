"use client"

import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"
import type { LedgerColumn, LedgerContext } from "./ledger-columns"
import { PlanYearDetail } from "./plan-year-detail"

/** Year and Age stay put while the money columns scroll sideways. */
export const STICKY_YEAR = "sticky left-0 z-[1] bg-card w-24 min-w-24"
export const STICKY_AGE = "sticky left-24 z-[1] bg-card"

/** One column's value in a cell: money, a rate, or a dash when there's nothing. */
export function LedgerCell({ column, value, itemized, bold }: { column: LedgerColumn; value: number | null; itemized?: boolean; bold?: boolean }) {
  const empty = value === null || (column.kind !== "rate" && Math.abs(value) < 0.5)
  const shown = empty ? "—" : column.kind === "rate" ? fmtPct(value!, 1) : `${fmtMoney(value!)}${itemized ? "*" : ""}`
  return (
    <td
      className={cn(
        "px-3 py-2 text-right tabular-nums whitespace-nowrap",
        bold && "font-semibold",
        !empty && column.tone === "neg" && "text-error",
        !empty && column.tone === "pos" && "text-success",
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
  columns,
  ctx,
  expanded,
  onToggle,
}: {
  row: YearRow
  doc: PlanDocument
  columns: LedgerColumn[]
  ctx: LedgerContext
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn("group border-t border-card-border cursor-pointer hover:bg-row-hover", row.shortfall > 0.5 && "bg-error/5")}
      >
        <td className={cn("px-3 py-2 whitespace-nowrap group-hover:bg-row-hover", STICKY_YEAR)}>
          <span className="material-symbols-rounded align-middle text-foreground-muted mr-1" style={{ fontSize: 14 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
          {row.year}
        </td>
        <td className={cn("px-3 py-2 tabular-nums whitespace-nowrap group-hover:bg-row-hover", STICKY_AGE)}>
          {row.ages.join(" / ")}
          {row.milestones.length > 0 && (
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title={row.milestones.join(", ")}>
              {row.milestones.length === 1 ? row.milestones[0] : `${row.milestones.length} milestones`}
            </span>
          )}
        </td>
        {columns.map((c) => (
          <LedgerCell key={c.id} column={c} value={c.value(row, ctx)} itemized={c.id === "deduction" && row.deduction?.itemized} />
        ))}
      </tr>
      {expanded && (
        <tr className="bg-background-secondary/40">
          <td colSpan={columns.length + 2} className="px-3 py-3">
            <PlanYearDetail row={row} doc={doc} />
          </td>
        </tr>
      )}
    </>
  )
}

"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { BASIC_LEDGER_VIEW } from "@/lib/plans/plan-mode"
import { cn } from "@/lib/utils"
import type { DollarBasis, PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { columnsFor, LEDGER_VIEWS, lifetimeValue, startBalances, type LedgerView } from "./ledger-columns"
import { downloadLedgerCsv } from "./ledger-csv"
import { LedgerCell, PlanLedgerRow, STICKY_AGE, STICKY_YEAR } from "./plan-ledger-row"

/** Header cells stick to the top of the table's scroll area, with a hairline under them. */
const HEADER_CELL = "sticky top-0 z-[2] bg-card shadow-[inset_0_-1px_0_var(--card-border)]"

/** Remembered per browser: which set of columns the ledger shows. */
const VIEW_KEY = "pw-plan-ledger-view"
const VIEW_OPTIONS = (Object.keys(LEDGER_VIEWS) as LedgerView[]).map((v) => ({ value: v, label: LEDGER_VIEWS[v].label }))

function readView(): LedgerView {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    return saved && saved in LEDGER_VIEWS ? (saved as LedgerView) : "summary"
  } catch {
    return "summary"
  }
}

/** Year-by-year ledger with switchable column sets, a lifetime row, and a CSV download of every column. */
export const PlanLedgerTable = memo(function PlanLedgerTable({
  doc,
  rows,
  basis,
  isHidden,
  fileName = "plan-ledger",
}: {
  doc: PlanDocument
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
  fileName?: string
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [savedView, setViewState] = useState<LedgerView>("summary")
  useEffect(() => setViewState(readView()), [])
  // Basic shows only the summary columns; the saved choice comes back in Advanced.
  const { isBasic } = usePlanMode()
  const view = isBasic ? BASIC_LEDGER_VIEW : savedView
  const setView = (v: LedgerView) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode: stays for this visit */
    }
  }
  const columns = useMemo(() => columnsFor(view), [view])
  const starts = useMemo(() => startBalances(doc, rows), [doc, rows])
  const ctx = (i: number) => ({ doc, startBalance: starts[i] })

  return (
    <FireSectionCard
      eyebrow="Ledger"
      title={`Every year of the plan, ${basis === "today" ? "in today's dollars" : "in future dollars"}`}
      info="Growth is applied to start-of-year balances; the year's income, spending and contributions land at year end. Hover a column name for what it holds; click a year for detail. * = itemized deduction."
      right={
        <div className="flex flex-wrap items-center gap-3">
          {!isBasic && <ChoiceChips label="Columns" options={VIEW_OPTIONS} value={view} onChange={setView} />}
          <button
            type="button"
            onClick={() => downloadLedgerCsv(doc, rows, `${fileName}-${basis === "today" ? "todays-dollars" : "future-dollars"}.csv`)}
            className="btn-secondary text-xs inline-flex items-center gap-1"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>download</span>
            CSV
          </button>
        </div>
      }
    >
      {/* Scrolls on its own (up to a screen tall) so the header row stays in view; Year and Age stay pinned sideways. */}
      <div className="overflow-auto max-h-[calc(100dvh-5rem)] -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className={cn("px-3 py-2 font-semibold text-left", STICKY_YEAR, HEADER_CELL, "z-[3]")}>Year</th>
              <th className={cn("px-3 py-2 font-semibold text-left", STICKY_AGE, HEADER_CELL, "z-[3]")}>Age</th>
              {columns.map((c) => (
                <th key={c.id} title={c.hint} className={cn("px-3 py-2 font-semibold whitespace-nowrap text-right cursor-help", HEADER_CELL)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <PlanLedgerRow
                key={row.index}
                row={row}
                doc={doc}
                columns={columns}
                ctx={ctx(i)}
                expanded={expanded === row.index}
                onToggle={() => setExpanded(expanded === row.index ? null : row.index)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-card-border">
              <td className={cn("px-3 py-2 font-semibold", STICKY_YEAR)}>Lifetime</td>
              <td className={cn("px-3 py-2 text-[11px] text-foreground-muted", STICKY_AGE)}>sums · balances at end</td>
              {columns.map((c) => (
                <LedgerCell key={c.id} column={c} value={lifetimeValue(c, rows, ctx)} bold />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </FireSectionCard>
  )
})

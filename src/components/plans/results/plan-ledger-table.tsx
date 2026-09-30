"use client"

import { memo, useState } from "react"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { DollarBasis, PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { PlanLedgerRow } from "./plan-ledger-row"

const COLUMNS = ["Year", "Age", "Income", "Taxes", "Spending", "Debt", "Contributions", "Withdrawn", "Net worth"]

/** Year-by-year cash-flow ledger. */
export const PlanLedgerTable = memo(function PlanLedgerTable({
  doc,
  rows,
  basis,
  isHidden,
}: {
  doc: PlanDocument
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  return (
    <FireSectionCard
      eyebrow="Ledger"
      title={`Every year of the plan, ${basis === "today" ? "in today's dollars" : "in future dollars"}`}
      info="Growth is applied to start-of-year balances; the year's income, spending and contributions land at year end. Click a year for detail."
    >
      <div className="overflow-x-auto -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              {COLUMNS.map((c, i) => (
                <th key={c} className={`px-3 py-2 font-semibold whitespace-nowrap ${i < 2 ? "text-left" : "text-right"}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PlanLedgerRow
                key={row.index}
                row={row}
                doc={doc}
                expanded={expanded === row.index}
                onToggle={() => setExpanded(expanded === row.index ? null : row.index)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </FireSectionCard>
  )
})

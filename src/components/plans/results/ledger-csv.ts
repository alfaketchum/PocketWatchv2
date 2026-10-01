import type { YearRow, PlanDocument } from "@/lib/plans/plan-types"
import { LEDGER_COLUMNS, startBalances } from "./ledger-columns"

const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** Every ledger column for every year, as CSV (money rounded to dollars, rates as decimals). */
export function ledgerCsv(doc: PlanDocument, rows: YearRow[]): string {
  const starts = startBalances(doc, rows)
  const header = ["Year", "Age", ...LEDGER_COLUMNS.map((c) => c.label), "Milestones"]
  const lines = rows.map((r, i) => {
    const ctx = { doc, startBalance: starts[i] }
    const values = LEDGER_COLUMNS.map((c) => {
      const v = c.value(r, ctx)
      if (v === null) return ""
      return c.kind === "rate" ? v.toFixed(4) : String(Math.round(v))
    })
    return [String(r.year), r.ages.join("/"), ...values, r.milestones.join("; ")]
  })
  return [header, ...lines].map((cols) => cols.map(quote).join(",")).join("\n")
}

/** Saves the ledger as a .csv file. */
export function downloadLedgerCsv(doc: PlanDocument, rows: YearRow[], fileName: string): void {
  const blob = new Blob([ledgerCsv(doc, rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

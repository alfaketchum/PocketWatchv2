import type { DollarBasis, YearRow } from "./plan-types"

const FLOW_FIELDS = [
  "income",
  "employerMatch",
  "incomeTax",
  "withdrawalTax",
  "saleTax",
  "deposits",
  "taxableIncome",
  "assetAppreciation",
  "assetDepreciation",
  "expenses",
  "debtPayments",
  "assetPurchases",
  "assetSales",
  "contributions",
  "withdrawals",
  "growth",
  "shortfall",
] as const

const BALANCE_FIELDS = ["accountsTotal", "assetsTotal", "debtsTotal", "netWorth", "financialNetWorth"] as const

function scaleRecord(record: Record<string, number>, factor: number): Record<string, number> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v / factor]))
}

/**
 * Deflator for year `index`: flows during the year are in year-`index` dollars;
 * year-end balances are one year further out.
 */
export function deflator(inflation: number, index: number, kind: "flow" | "balance"): number {
  return Math.pow(1 + inflation, kind === "flow" ? index : index + 1)
}

/** A row expressed in today's dollars. */
export function rowInTodaysDollars(row: YearRow, inflation: number): YearRow {
  const flow = deflator(inflation, row.index, "flow")
  const balance = deflator(inflation, row.index, "balance")
  const out: YearRow = {
    ...row,
    incomeBy: scaleRecord(row.incomeBy, flow),
    expensesBy: scaleRecord(row.expensesBy, flow),
    contributionsBy: scaleRecord(row.contributionsBy, flow),
    employerMatchBy: scaleRecord(row.employerMatchBy, flow),
    withdrawalsBy: scaleRecord(row.withdrawalsBy, flow),
    depositsBy: scaleRecord(row.depositsBy, flow),
    surplusBy: scaleRecord(row.surplusBy, flow),
    shortfallBy: scaleRecord(row.shortfallBy, flow),
    balances: scaleRecord(row.balances, balance),
    assetValues: scaleRecord(row.assetValues, balance),
    debtBalances: scaleRecord(row.debtBalances, balance),
  }
  for (const f of FLOW_FIELDS) out[f] = row[f] / flow
  for (const f of BALANCE_FIELDS) out[f] = row[f] / balance
  return out
}

export function rowsForBasis(rows: YearRow[], basis: DollarBasis, inflation: number): YearRow[] {
  return basis === "future" ? rows : rows.map((r) => rowInTodaysDollars(r, inflation))
}

/** Real return implied by a nominal return: (1 + nominal) / (1 + inflation) − 1. */
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1
}

/** Nominal return that gives `real` after inflation: (1 + real) × (1 + inflation) − 1. */
export function nominalRate(real: number, inflation: number): number {
  return (1 + real) * (1 + inflation) - 1
}

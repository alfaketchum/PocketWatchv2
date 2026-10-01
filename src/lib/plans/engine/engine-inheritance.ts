import type { Inflation } from "../plan-inflation"
import { resolveTiming, type TimingContext } from "../plan-timing"
import type { PlanAccount, PlanDeposit } from "../plan-types"
import { deposit, type Holdings } from "./engine-cashflow"
import { grown } from "./engine-flows"

export interface DepositEntry {
  deposit: PlanDeposit
  index: number | null
}

export function depositEntries(deposits: PlanDeposit[], ctx: TimingContext): DepositEntry[] {
  return deposits.map((d) => ({ deposit: d, index: resolveTiming(d.timing, ctx) }))
}

/**
 * One-time deposits that land in their account this year, outside cash flow. Into a taxable account
 * the whole amount is cost basis: inherited investments get a stepped-up basis.
 */
export function applyDeposits(
  entries: DepositEntry[],
  accounts: PlanAccount[],
  holdings: Holdings,
  index: number,
  inflation: Inflation,
): { holdings: Holdings; total: number; byAccount: Record<string, number> } {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  let current = holdings
  let total = 0
  const byAccount: Record<string, number> = {}
  for (const { deposit: d, index: at } of entries) {
    const account = byId.get(d.accountId)
    if (!account || at !== index) continue
    const amount = grown(d.amount, null, inflation, index)
    current = deposit(current, account, amount)
    byAccount[account.id] = (byAccount[account.id] ?? 0) + amount
    total += amount
  }
  return { holdings: current, total, byAccount }
}

export interface DrainResult {
  holdings: Holdings
  /** Cash reaching your cash flow after tax. */
  net: number
  tax: number
  /** Taxable income from traditional distributions. */
  taxable: number
  byAccount: Record<string, number>
}

/**
 * Inherited retirement accounts must be empty by `drainByYear`: each year take an even share of
 * what's left (balance ÷ years remaining). Traditional withdrawals are taxed as income; Roth aren't.
 */
export function drainInherited(accounts: PlanAccount[], holdings: Holdings, year: number, incomeTaxRate: number): DrainResult {
  let balances = holdings.balances
  let net = 0
  let tax = 0
  let taxable = 0
  const byAccount: Record<string, number> = {}
  for (const account of accounts) {
    if (!account.drainByYear || year > account.drainByYear) continue
    const balance = balances[account.id] ?? 0
    if (balance <= 0) continue
    const amount = balance / (account.drainByYear - year + 1)
    const owed = account.taxTreatment === "traditional" ? amount * incomeTaxRate : 0
    balances = { ...balances, [account.id]: balance - amount }
    byAccount[account.id] = amount
    net += amount - owed
    tax += owed
    if (account.taxTreatment === "traditional") taxable += amount
  }
  return { holdings: { ...holdings, balances }, net, tax, taxable, byAccount }
}

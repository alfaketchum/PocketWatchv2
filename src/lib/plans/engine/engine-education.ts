import { isActive, resolveRange, type ResolvedRange, type TimingContext } from "../plan-timing"
import type { PlanTransfer } from "../plan-children"
import type { PlanAccount, PlanExpense } from "../plan-types"
import { deposit, type Holdings } from "./engine-cashflow"
import { grown } from "./engine-flows"

export interface TransferEntry {
  transfer: PlanTransfer
  range: ResolvedRange
}

export function transferEntries(transfers: PlanTransfer[], ctx: TimingContext): TransferEntry[] {
  return transfers.map((transfer) => ({ transfer, range: resolveRange(transfer.start, transfer.end, ctx) }))
}

/** This year's fixed contributions (e.g. 529), deposited from cash flow. */
export function applyTransfers(
  entries: TransferEntry[],
  accounts: PlanAccount[],
  holdings: Holdings,
  index: number,
  inflation: number,
): { holdings: Holdings; total: number; byAccount: Record<string, number> } {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  let current = holdings
  let total = 0
  const byAccount: Record<string, number> = {}
  for (const { transfer, range } of entries) {
    const account = byId.get(transfer.accountId)
    if (!account || !isActive(range, index, false)) continue
    const amount = grown(transfer.amount, null, inflation, index)
    current = deposit(current, account, amount)
    byAccount[account.id] = (byAccount[account.id] ?? 0) + amount
    total += amount
  }
  return { holdings: current, total, byAccount }
}

/**
 * Pay expenses earmarked for an account (college from a 529) out of that account first, tax-free.
 * Returns what was drawn; the rest of those expenses falls to normal cash flow.
 */
export function drawEarmarked(
  expenses: PlanExpense[],
  expensesBy: Record<string, number>,
  holdings: Holdings,
): { holdings: Holdings; drawn: number; byAccount: Record<string, number> } {
  const need: Record<string, number> = {}
  for (const e of expenses) {
    if (e.fundedBy && expensesBy[e.id]) need[e.fundedBy] = (need[e.fundedBy] ?? 0) + expensesBy[e.id]
  }
  let balances = holdings.balances
  let drawn = 0
  const byAccount: Record<string, number> = {}
  for (const [accountId, amount] of Object.entries(need)) {
    const take = Math.min(amount, Math.max(0, balances[accountId] ?? 0))
    if (take <= 0) continue
    balances = { ...balances, [accountId]: (balances[accountId] ?? 0) - take }
    byAccount[accountId] = take
    drawn += take
  }
  return { holdings: { ...holdings, balances }, drawn, byAccount }
}

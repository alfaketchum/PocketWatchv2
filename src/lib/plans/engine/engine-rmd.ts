import { accountOwner, ageInYear, ownTraditional, penaltyFree, rmdDivisor, rmdStartAge } from "../tax/retirement-rules-2026"
import type { PlanDocument } from "../plan-types"
import type { Holdings } from "./engine-cashflow"
import type { DrainResult } from "./engine-inheritance"

/**
 * Required minimum distributions: from the year the owner reaches 73 (75 if born 1960+), each traditional account
 * pays out last year-end's balance ÷ the IRS Uniform Lifetime factor for their age, taxed as income. The cash goes into
 * the year's cash flow, so it pays spending first and anything left is saved by the surplus rules. Roth, HSA and
 * inherited accounts (10-year rule) have none.
 */
export function takeRequired(doc: PlanDocument, lastYearEnd: Holdings, holdings: Holdings, year: number, incomeTaxRate: number): DrainResult {
  let balances = holdings.balances
  let net = 0
  let tax = 0
  let taxable = 0
  const byAccount: Record<string, number> = {}
  for (const account of doc.accounts) {
    const owner = accountOwner(account, doc)
    if (!owner || !ownTraditional(account)) continue
    const age = ageInYear(owner, year)
    if (age < rmdStartAge(owner.birthYear)) continue
    const balance = balances[account.id] ?? 0
    const amount = Math.min(balance, (lastYearEnd.balances[account.id] ?? 0) / rmdDivisor(age))
    if (amount <= 0) continue
    const owed = amount * incomeTaxRate
    balances = { ...balances, [account.id]: balance - amount }
    byAccount[account.id] = amount
    net += amount - owed
    tax += owed
    taxable += amount
  }
  return { holdings: { ...holdings, balances }, net, tax, taxable, byAccount }
}

/** Accounts a withdrawal from would cost the 10% early penalty this year: own traditional accounts of owners under 59½. */
export function penalizedAccounts(doc: PlanDocument, year: number): Set<string> {
  return new Set(
    doc.accounts.filter((a) => {
      const owner = accountOwner(a, doc)
      return ownTraditional(a) && !!owner && !penaltyFree(owner, year)
    }).map((a) => a.id),
  )
}

import { DEFAULT_WITHDRAWAL_ORDER, SURPLUS_OVERFLOW_ORDER } from "../plan-constants"
import type { PlanAccount, PlanDocument, TaxTreatment } from "../plan-types"

/** Account balances and taxable cost basis, keyed by account id. */
export interface Holdings {
  balances: Record<string, number>
  basis: Record<string, number>
}

function add(record: Record<string, number>, key: string, amount: number): Record<string, number> {
  return { ...record, [key]: (record[key] ?? 0) + amount }
}

/** Deposit into an account; deposits into taxable accounts add to cost basis. */
export function deposit(holdings: Holdings, account: PlanAccount, amount: number): Holdings {
  return {
    balances: add(holdings.balances, account.id, amount),
    basis: account.taxTreatment === "taxable" ? add(holdings.basis, account.id, amount) : holdings.basis,
  }
}

function firstByTreatment(accounts: PlanAccount[], order: TaxTreatment[]): PlanAccount | null {
  for (const treatment of order) {
    const match = accounts.find((a) => a.taxTreatment === treatment)
    if (match) return match
  }
  return null
}

export interface SurplusResult {
  holdings: Holdings
  depositsBy: Record<string, number>
}

/**
 * Surplus fills the cash buffer, then the plan's surplus order up to each cap; the rest goes to
 * the last uncapped target, else the first taxable (then cash, …) account.
 */
export function depositSurplus(
  amount: number,
  holdings: Holdings,
  doc: PlanDocument,
  inflationFactor: number,
): SurplusResult {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  let left = amount
  let current = holdings
  let depositsBy: Record<string, number> = {}
  const put = (account: PlanAccount, value: number) => {
    if (value <= 0) return
    current = deposit(current, account, value)
    depositsBy = add(depositsBy, account.id, value)
    left -= value
  }

  const cash = doc.accounts.find((a) => a.taxTreatment === "cash")
  if (cash) {
    const target = doc.settings.cashBuffer * inflationFactor
    put(cash, Math.min(left, Math.max(0, target - (current.balances[cash.id] ?? 0))))
  }
  let overflow: PlanAccount | null = null
  for (const target of doc.cashFlow.surplusOrder) {
    const account = byId.get(target.accountId)
    if (!account) continue
    if (target.annualCap === null) {
      overflow = account
      put(account, left)
    } else {
      put(account, Math.min(left, target.annualCap * inflationFactor))
    }
  }
  const fallback = overflow ?? firstByTreatment(doc.accounts, SURPLUS_OVERFLOW_ORDER)
  if (fallback) put(fallback, left)
  return { holdings: current, depositsBy }
}

/** Accounts in withdrawal order: the plan's own order first, the rest by tax treatment. */
export function withdrawalSequence(doc: PlanDocument): PlanAccount[] {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  const explicit = doc.cashFlow.withdrawalOrder.map((id) => byId.get(id)).filter((a): a is PlanAccount => !!a)
  const listed = new Set(explicit.map((a) => a.id))
  const rest = doc.accounts
    .filter((a) => !listed.has(a.id))
    .sort((a, b) => DEFAULT_WITHDRAWAL_ORDER.indexOf(a.taxTreatment) - DEFAULT_WITHDRAWAL_ORDER.indexOf(b.taxTreatment))
  return [...explicit, ...rest]
}

/** Share of a withdrawal that counts as taxable income: all of it (traditional) or the gains (taxable). */
function taxableShare(account: PlanAccount, holdings: Holdings): number {
  if (account.taxTreatment === "traditional") return 1
  if (account.taxTreatment !== "taxable") return 0
  const balance = holdings.balances[account.id] ?? 0
  if (balance <= 0) return 0
  return Math.max(0, 1 - (holdings.basis[account.id] ?? 0) / balance)
}

/** Share of a withdrawal lost to tax for this account right now. */
function withdrawalTaxRate(account: PlanAccount, holdings: Holdings, doc: PlanDocument): number {
  const rate = account.taxTreatment === "traditional" ? doc.settings.incomeTaxRate : doc.settings.capitalGainsRate
  return taxableShare(account, holdings) * rate
}

function withdraw(holdings: Holdings, account: PlanAccount, gross: number): Holdings {
  const balance = holdings.balances[account.id] ?? 0
  const remaining = Math.max(0, balance - gross)
  const basis =
    account.taxTreatment === "taxable" && balance > 0
      ? { ...holdings.basis, [account.id]: (holdings.basis[account.id] ?? 0) * (remaining / balance) }
      : holdings.basis
  return { balances: { ...holdings.balances, [account.id]: remaining }, basis }
}

export interface DeficitResult {
  holdings: Holdings
  withdrawalsBy: Record<string, number>
  tax: number
  /** Traditional withdrawals plus realized gains: the part of withdrawals that is taxable income. */
  taxableWithdrawn: number
  shortfall: number
}

/** Cover `need` (after tax) by withdrawing in order, grossing each withdrawal up for its tax. */
export function coverDeficit(need: number, holdings: Holdings, doc: PlanDocument): DeficitResult {
  let left = need
  let current = holdings
  let withdrawalsBy: Record<string, number> = {}
  let tax = 0
  let taxableWithdrawn = 0
  for (const account of withdrawalSequence(doc)) {
    if (left <= 0) break
    const balance = current.balances[account.id] ?? 0
    const rate = withdrawalTaxRate(account, current, doc)
    if (balance <= 0 || rate >= 1) continue
    const net = Math.min(left, balance * (1 - rate))
    const gross = net / (1 - rate)
    taxableWithdrawn += gross * taxableShare(account, current)
    current = withdraw(current, account, gross)
    withdrawalsBy = add(withdrawalsBy, account.id, gross)
    tax += gross - net
    left -= net
  }
  return { holdings: current, withdrawalsBy, tax, taxableWithdrawn, shortfall: Math.max(0, left) }
}

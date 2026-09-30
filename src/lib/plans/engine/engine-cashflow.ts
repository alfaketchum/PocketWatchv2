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

/** The cash account that holds the buffer: the chosen one, else the first cash account. */
export function bufferAccount(doc: PlanDocument): PlanAccount | null {
  const cash = doc.accounts.filter((a) => a.taxTreatment === "cash")
  return cash.find((a) => a.id === doc.settings.bufferAccountId) ?? cash[0] ?? null
}

/** Where surplus lands when no listed target is uncapped: the first taxable (then cash, …) account. */
export function surplusOverflowAccount(doc: PlanDocument): PlanAccount | null {
  return firstByTreatment(doc.accounts, SURPLUS_OVERFLOW_ORDER)
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

  const cash = bufferAccount(doc)
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
  const fallback = overflow ?? surplusOverflowAccount(doc)
  if (fallback) put(fallback, left)
  return { holdings: current, depositsBy }
}

/** Accounts in withdrawal order: the plan's own order first, the rest by tax treatment. */
export function withdrawalSequence(doc: PlanDocument): PlanAccount[] {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  const explicit = doc.cashFlow.withdrawalOrder
    .map((id) => byId.get(id))
    .filter((a): a is PlanAccount => !!a && a.taxTreatment !== "education")
  const listed = new Set(explicit.map((a) => a.id))
  // Education (529) accounts only pay the expenses earmarked for them, never general shortfalls.
  const rest = doc.accounts
    .filter((a) => !listed.has(a.id) && a.taxTreatment !== "education")
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
  /** Of that: traditional withdrawals (ordinary income) and realized gains (capital gains). */
  ordinaryWithdrawn: number
  gainsRealized: number
  shortfall: number
}

/**
 * Cover `need` (after tax) by withdrawing in order, grossing each withdrawal up for its tax.
 * With a protected buffer, the buffer account first gives only what's above the buffer; the
 * buffer itself is spent last, once every other account is empty.
 */
export function coverDeficit(need: number, holdings: Holdings, doc: PlanDocument, inflationFactor: number): DeficitResult {
  const buffer = doc.settings.protectBuffer ? bufferAccount(doc) : null
  const reserve = buffer ? doc.settings.cashBuffer * inflationFactor : 0
  const passes: { account: PlanAccount; keep: number }[] = [
    ...withdrawalSequence(doc).map((account) => ({ account, keep: account.id === buffer?.id ? reserve : 0 })),
    ...(buffer && reserve > 0 ? [{ account: buffer, keep: 0 }] : []),
  ]
  let left = need
  let current = holdings
  let withdrawalsBy: Record<string, number> = {}
  let tax = 0
  let ordinaryWithdrawn = 0
  let gainsRealized = 0
  for (const { account, keep } of passes) {
    if (left <= 0) break
    const balance = (current.balances[account.id] ?? 0) - keep
    const rate = withdrawalTaxRate(account, current, doc)
    if (balance <= 0 || rate >= 1) continue
    const net = Math.min(left, balance * (1 - rate))
    const gross = net / (1 - rate)
    const taxablePart = gross * taxableShare(account, current)
    if (account.taxTreatment === "traditional") ordinaryWithdrawn += taxablePart
    else gainsRealized += taxablePart
    current = withdraw(current, account, gross)
    withdrawalsBy = add(withdrawalsBy, account.id, gross)
    tax += gross - net
    left -= net
  }
  return {
    holdings: current,
    withdrawalsBy,
    tax,
    taxableWithdrawn: ordinaryWithdrawn + gainsRealized,
    ordinaryWithdrawn,
    gainsRealized,
    shortfall: Math.max(0, left),
  }
}

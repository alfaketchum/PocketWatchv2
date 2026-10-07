import { DEFAULT_WITHDRAWAL_ORDER, SURPLUS_OVERFLOW_ORDER } from "../plan-constants"
import type { PlanAccount, PlanDocument, TaxTreatment } from "../plan-types"
import { EARLY_WITHDRAWAL_PENALTY } from "../tax/retirement-rules-2026"
import type { RothTranche } from "./engine-roth-ledger"

/** Account balances and taxable cost basis, keyed by account id. */
export interface Holdings {
  balances: Record<string, number>
  basis: Record<string, number>
}

function add(record: Record<string, number>, key: string, amount: number): Record<string, number> {
  return { ...record, [key]: (record[key] ?? 0) + amount }
}

/** Deposit into an account; deposits into taxable accounts add to cost basis (all of it, unless `basis` says less). */
export function deposit(holdings: Holdings, account: PlanAccount, amount: number, basis = amount): Holdings {
  return {
    balances: add(holdings.balances, account.id, amount),
    basis: account.taxTreatment === "taxable" ? add(holdings.basis, account.id, basis) : holdings.basis,
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

/**
 * Accounts in withdrawal order: the plan's own order first, the rest by tax treatment. `penalized` accounts (owner under
 * 59½) move to the end unless the plan turned that off, so the 10% penalty is paid only when nothing else is left.
 */
export function withdrawalSequence(doc: PlanDocument, penalized: ReadonlySet<string> = new Set()): PlanAccount[] {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  const explicit = doc.cashFlow.withdrawalOrder
    .map((id) => byId.get(id))
    .filter((a): a is PlanAccount => !!a && a.taxTreatment !== "education")
  const listed = new Set(explicit.map((a) => a.id))
  // Education (529) accounts only pay the expenses earmarked for them, never general shortfalls.
  const rest = doc.accounts
    .filter((a) => !listed.has(a.id) && a.taxTreatment !== "education")
    .sort((a, b) => DEFAULT_WITHDRAWAL_ORDER.indexOf(a.taxTreatment) - DEFAULT_WITHDRAWAL_ORDER.indexOf(b.taxTreatment))
  const ordered = [...explicit, ...rest]
  if (doc.cashFlow.avoidEarlyPenalty === false || penalized.size === 0) return ordered
  return [...ordered.filter((a) => !penalized.has(a.id)), ...ordered.filter((a) => penalized.has(a.id))]
}

/** Share of a withdrawal that counts as taxable income: all of it (traditional) or the gains (taxable). */
function taxableShare(account: PlanAccount, holdings: Holdings): number {
  if (account.taxTreatment === "traditional") return 1
  if (account.taxTreatment !== "taxable") return 0
  const balance = holdings.balances[account.id] ?? 0
  if (balance <= 0) return 0
  return Math.max(0, 1 - (holdings.basis[account.id] ?? 0) / balance)
}

/** Tax rate on this account's gains: short-term gains are taxed as ordinary income. */
export function gainsRate(account: PlanAccount, doc: PlanDocument): number {
  const short = account.shortTermShare ?? 0
  return (1 - short) * doc.settings.capitalGainsRate + short * doc.settings.incomeTaxRate
}

/** Share of a withdrawal lost to tax for this account right now. */
function withdrawalTaxRate(account: PlanAccount, holdings: Holdings, doc: PlanDocument): number {
  const rate = account.taxTreatment === "traditional" ? doc.settings.incomeTaxRate : gainsRate(account, doc)
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
  /** Of that: traditional withdrawals (ordinary income) and realized gains, long- and short-term. */
  ordinaryWithdrawn: number
  gainsRealized: number
  shortGainsRealized: number
  /** The 10% early-withdrawal penalty paid (kept apart from `tax`, which the bracket true-up settles). */
  penalty: number
  shortfall: number
}

interface DeficitPass {
  account: PlanAccount
  /** Left in the account by this pass (the protected buffer). */
  keep: number
  /** Most this pass takes (a Roth tranche); Infinity for the rest of the account. */
  cap: number
  penaltyRate: number
}

/**
 * Roth accounts with conversions still seasoning come out in tranches: penalty-free money first, the young
 * conversions (10%) after, then earnings. With `avoidEarly` the penalized tranche waits until the end.
 */
function rothPasses(account: PlanAccount, tranche: RothTranche, avoidEarly: boolean): { now: DeficitPass[]; last: DeficitPass[] } {
  const free = { account, keep: 0, cap: tranche.free, penaltyRate: 0 }
  const young = { account, keep: 0, cap: tranche.penalized, penaltyRate: EARLY_WITHDRAWAL_PENALTY }
  const earnings = { account, keep: 0, cap: Infinity, penaltyRate: 0 }
  return avoidEarly ? { now: [free], last: [young, earnings] } : { now: [free, young, earnings], last: [] }
}

function deficitPasses(doc: PlanDocument, penalized: ReadonlySet<string>, tranches: Record<string, RothTranche>, buffer: PlanAccount | null, reserve: number): DeficitPass[] {
  const avoidEarly = doc.cashFlow.avoidEarlyPenalty !== false
  const now: DeficitPass[] = []
  const last: DeficitPass[] = []
  for (const account of withdrawalSequence(doc, penalized)) {
    const tranche = tranches[account.id]
    if (tranche) {
      const roth = rothPasses(account, tranche, avoidEarly)
      now.push(...roth.now)
      last.push(...roth.last)
      continue
    }
    const penaltyRate = penalized.has(account.id) ? EARLY_WITHDRAWAL_PENALTY : 0
    now.push({ account, keep: account.id === buffer?.id ? reserve : 0, cap: Infinity, penaltyRate })
  }
  return [...now, ...last, ...(buffer && reserve > 0 ? [{ account: buffer, keep: 0, cap: Infinity, penaltyRate: 0 }] : [])]
}

/**
 * Cover `need` (after tax) by withdrawing in order, grossing each withdrawal up for its tax (and the 10% penalty on
 * `penalized` accounts and on Roth conversions still seasoning, per `tranches`). With a protected buffer, the buffer
 * account first gives only what's above the buffer; the buffer itself is spent last, once every other account is empty.
 */
export function coverDeficit(
  need: number,
  holdings: Holdings,
  doc: PlanDocument,
  inflationFactor: number,
  penalized: ReadonlySet<string> = new Set(),
  tranches: Record<string, RothTranche> = {},
): DeficitResult {
  const buffer = doc.settings.protectBuffer ? bufferAccount(doc) : null
  const reserve = buffer ? doc.settings.cashBuffer * inflationFactor : 0
  const passes = deficitPasses(doc, penalized, tranches, buffer, reserve)
  let left = need
  let current = holdings
  let withdrawalsBy: Record<string, number> = {}
  let tax = 0
  let ordinaryWithdrawn = 0
  let gainsRealized = 0
  let shortGainsRealized = 0
  let penalty = 0
  for (const { account, keep, cap, penaltyRate } of passes) {
    if (left <= 0) break
    const balance = Math.min((current.balances[account.id] ?? 0) - keep, cap)
    const rate = withdrawalTaxRate(account, current, doc) + penaltyRate
    if (balance <= 0 || rate >= 1) continue
    const net = Math.min(left, balance * (1 - rate))
    const gross = net / (1 - rate)
    const taxablePart = gross * taxableShare(account, current)
    if (account.taxTreatment === "traditional") ordinaryWithdrawn += taxablePart
    else {
      const short = account.shortTermShare ?? 0
      shortGainsRealized += taxablePart * short
      gainsRealized += taxablePart * (1 - short)
    }
    current = withdraw(current, account, gross)
    withdrawalsBy = add(withdrawalsBy, account.id, gross)
    penalty += gross * penaltyRate
    tax += gross - net - gross * penaltyRate
    left -= net
  }
  return {
    holdings: current,
    withdrawalsBy,
    tax,
    taxableWithdrawn: ordinaryWithdrawn + gainsRealized + shortGainsRealized,
    ordinaryWithdrawn,
    gainsRealized,
    shortGainsRealized,
    penalty,
    shortfall: Math.max(0, left),
  }
}

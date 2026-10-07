/**
 * The Roth 5-year rule for conversions: each conversion is its own lot, and converted money withdrawn within 5 tax
 * years while the owner is under 59½ pays the 10% penalty. Withdrawals come out in the IRS order: contributions
 * first, then conversions oldest first, then earnings. Assumptions: a Roth's opening balance counts as
 * contributions, and earnings come out tax- and penalty-free (as everywhere else in the engine).
 */
import type { PlanDocument } from "../plan-types"
import { accountOwner, CONVERSION_SEASONING_YEARS, penaltyFree } from "../tax/retirement-rules-2026"

export interface RothLot {
  year: number
  amount: number
}

export interface RothLedger {
  contributions: number
  /** Oldest first. */
  lots: RothLot[]
}

export type RothLedgers = Record<string, RothLedger>

/** How much of a Roth comes out penalty-free before the converted money that is still seasoning. */
export interface RothTranche {
  /** Contributions plus seasoned conversions. */
  free: number
  /** Conversions under 5 years old: the 10% applies. */
  penalized: number
}

export function initialRothLedgers(doc: PlanDocument): RothLedgers {
  return Object.fromEntries(doc.accounts.filter((a) => a.taxTreatment === "roth").map((a) => [a.id, { contributions: a.balance, lots: [] }]))
}

const ledgerOf = (ledgers: RothLedgers, id: string): RothLedger => ledgers[id] ?? { contributions: 0, lots: [] }

/** Adds the year's contributions and conversions (by Roth account id). */
export function withInflows(ledgers: RothLedgers, contributedBy: Record<string, number>, convertedBy: Record<string, number>, year: number): RothLedgers {
  const next = { ...ledgers }
  for (const [id, amount] of Object.entries(contributedBy)) {
    if (!(id in next) || amount <= 0) continue
    next[id] = { ...next[id], contributions: next[id].contributions + amount }
  }
  for (const [id, amount] of Object.entries(convertedBy)) {
    if (amount <= 0) continue
    const ledger = ledgerOf(next, id)
    next[id] = { ...ledger, lots: [...ledger.lots, { year, amount }] }
  }
  return next
}

/** Penalty tranches for Roth accounts whose owner is under 59½ and still has young conversions; others are omitted. */
export function rothTranches(ledgers: RothLedgers, doc: PlanDocument, year: number): Record<string, RothTranche> {
  const out: Record<string, RothTranche> = {}
  for (const account of doc.accounts) {
    const ledger = ledgers[account.id]
    const owner = accountOwner(account, doc)
    if (account.taxTreatment !== "roth" || !ledger || !owner || penaltyFree(owner, year)) continue
    const young = ledger.lots.filter((l) => year - l.year < CONVERSION_SEASONING_YEARS)
    const penalized = young.reduce((s, l) => s + l.amount, 0)
    if (penalized <= 0) continue
    const seasoned = ledger.lots.filter((l) => year - l.year >= CONVERSION_SEASONING_YEARS).reduce((s, l) => s + l.amount, 0)
    out[account.id] = { free: ledger.contributions + seasoned, penalized }
  }
  return out
}

/** Takes `amount` out of a ledger: contributions, then lots oldest first; the rest is earnings. */
function withdrawn(ledger: RothLedger, amount: number): RothLedger {
  let left = amount
  const contributions = Math.max(0, ledger.contributions - left)
  left -= ledger.contributions - contributions
  const lots: RothLot[] = []
  for (const lot of ledger.lots) {
    const take = Math.min(lot.amount, left)
    left -= take
    if (lot.amount - take > 0) lots.push({ ...lot, amount: lot.amount - take })
  }
  return { contributions, lots }
}

export function withWithdrawals(ledgers: RothLedgers, withdrawnBy: Record<string, number>): RothLedgers {
  const next = { ...ledgers }
  for (const [id, amount] of Object.entries(withdrawnBy)) if (next[id] && amount > 0) next[id] = withdrawn(next[id], amount)
  return next
}

import { resolveRange, resolveTiming, type ResolvedRange, type TimingContext } from "../plan-timing"
import type { PlanAsset, PlanDebt } from "../plan-types"

const MONTHS = 12

export interface AssetEntry {
  asset: PlanAsset
  range: ResolvedRange
}

export interface DebtEntry {
  debt: PlanDebt
  /** Year the debt starts; debts that start at or before the plan are active from year 0. */
  start: number
}

export function assetEntries(assets: PlanAsset[], ctx: TimingContext): AssetEntry[] {
  return assets.map((asset) => ({ asset, range: resolveRange(asset.start, asset.end, ctx) }))
}

export function debtEntries(debts: PlanDebt[], ctx: TimingContext): DebtEntry[] {
  return debts.map((debt) => ({ debt, start: Math.max(0, resolveTiming(debt.start, ctx) ?? 0) }))
}

/** Asset value at the start of year `index`. */
export function assetValueAt(asset: PlanAsset, index: number): number {
  return asset.value * Math.pow(1 + asset.appreciation, index)
}

export function isOwned(range: ResolvedRange, index: number): boolean {
  return Math.max(0, range.start) <= index && index < range.end
}

/** Twelve monthly payments; the last one only clears what's left. */
export function amortizeYear(balance: number, rate: number, monthlyPayment: number): { balance: number; paid: number } {
  let remaining = balance
  let paid = 0
  for (let m = 0; m < MONTHS && remaining > 0; m++) {
    const withInterest = remaining * (1 + rate / MONTHS)
    const payment = Math.min(monthlyPayment, withInterest)
    remaining = withInterest - payment
    paid += payment
  }
  return { balance: remaining, paid }
}

export interface AssetEvents {
  debtBalances: Record<string, number>
  purchases: number
  sales: number
}

/**
 * Start-of-year events for year `index`: debts that start this year, asset purchases
 * (net of debts financing them) and asset sales (net of the debts they pay off).
 */
export function applyAssetEvents(
  assets: AssetEntry[],
  debts: DebtEntry[],
  debtBalances: Record<string, number>,
  index: number,
): AssetEvents {
  let balances = { ...debtBalances }
  for (const { debt, start } of debts) {
    if (start === index) balances = { ...balances, [debt.id]: debt.balance }
  }
  let purchases = 0
  let sales = 0
  for (const { asset, range } of assets) {
    const linked = debts.filter((d) => d.debt.assetId === asset.id)
    if (range.start > 0 && range.start === index) {
      const financed = linked.filter((d) => d.start === index).reduce((s, d) => s + d.debt.balance, 0)
      purchases += Math.max(0, assetValueAt(asset, index) - financed)
    }
    if (range.end === index && range.end > Math.max(0, range.start)) {
      const owed = linked.reduce((s, d) => s + (balances[d.debt.id] ?? 0), 0)
      sales += assetValueAt(asset, index) - owed
      for (const d of linked) balances = { ...balances, [d.debt.id]: 0 }
    }
  }
  return { debtBalances: balances, purchases, sales }
}

/** Pay every active debt for the year. */
export function payDebts(
  debts: DebtEntry[],
  debtBalances: Record<string, number>,
  index: number,
): { debtBalances: Record<string, number>; paid: number } {
  let balances = { ...debtBalances }
  let paid = 0
  for (const { debt, start } of debts) {
    const balance = balances[debt.id] ?? 0
    if (start > index || balance <= 0) continue
    const year = amortizeYear(balance, debt.rate, debt.monthlyPayment)
    balances = { ...balances, [debt.id]: year.balance }
    paid += year.paid
  }
  return { debtBalances: balances, paid }
}

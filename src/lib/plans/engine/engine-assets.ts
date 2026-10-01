import { livesIn } from "../plan-asset-costs"
import { resolveRange, resolveTiming, type ResolvedRange, type TimingContext } from "../plan-timing"
import type { PlanAsset, PlanDebt } from "../plan-types"

const MONTHS = 12

export interface AssetEntry {
  asset: PlanAsset
  range: ResolvedRange
  /** The plan's inflation: a future purchase costs today's value grown by it. */
  inflation: number
}

export interface DebtEntry {
  debt: PlanDebt
  /** Year the debt starts; debts that start at or before the plan are active from year 0. */
  start: number
}

export function assetEntries(assets: PlanAsset[], ctx: TimingContext, inflation: number): AssetEntry[] {
  return assets.map((asset) => ({ asset, range: resolveRange(asset.start, asset.end, ctx), inflation }))
}

export function debtEntries(debts: PlanDebt[], ctx: TimingContext): DebtEntry[] {
  return debts.map((debt) => ({ debt, start: Math.max(0, resolveTiming(debt.start, ctx) ?? 0) }))
}

/**
 * Value at the start of year `index` of an asset first owned in year `start`. `value` is in today's
 * dollars: a future purchase costs it grown by inflation, and only then gains or loses its own rate.
 */
export function assetValue(asset: PlanAsset, start: number, index: number, inflation: number): number {
  const bought = Math.max(0, start)
  return asset.value * Math.pow(1 + inflation, bought) * Math.pow(1 + asset.appreciation, index - bought)
}

export function assetValueAt(entry: AssetEntry, index: number): number {
  return assetValue(entry.asset, entry.range.start, index, entry.inflation)
}

export function isOwned(range: ResolvedRange, index: number): boolean {
  return Math.max(0, range.start) <= index && index < range.end
}

/** Twelve monthly payments; the last one only clears what's left. `interest` is the part of `paid` that was interest. */
export function amortizeYear(balance: number, rate: number, monthlyPayment: number): { balance: number; paid: number; interest: number } {
  let remaining = balance
  let paid = 0
  let interest = 0
  for (let m = 0; m < MONTHS && remaining > 0; m++) {
    const monthInterest = remaining * (rate / MONTHS)
    const withInterest = remaining + monthInterest
    const payment = Math.min(monthlyPayment, withInterest)
    remaining = withInterest - payment
    paid += payment
    interest += Math.min(payment, monthInterest)
  }
  return { balance: remaining, paid, interest }
}

export interface AssetEvents {
  debtBalances: Record<string, number>
  purchases: number
  sales: number
  /** Capital-gains tax on this year's sales. */
  saleTax: number
  /** Taxable gain from this year's sales (after the home exclusion): held over a year… */
  saleGains: number
  /** …of which from real estate… */
  saleRealEstateGains: number
  /** …and held a year or less (taxed as ordinary income). */
  saleShortGains: number
}

/** Home-sale exclusion (not inflation-indexed): single / married filing jointly. */
export const HOME_SALE_EXCLUSION = { single: 250_000, joint: 500_000 }
/** Years you must have owned (and lived in) a home to use the exclusion; only a home you live in qualifies. */
const EXCLUSION_MIN_YEARS = 2

export interface SaleTaxRules {
  capitalGainsRate: number
  /** Short-term gains are taxed at this (ordinary income) rate. */
  incomeTaxRate: number
  /** Two people in the plan: the joint home-sale exclusion applies. */
  joint: boolean
}

/** Cost basis when sold: set explicitly, else its value when acquired (purchase price or stepped-up value). */
export function assetBasis(entry: AssetEntry): number {
  return entry.asset.costBasis ?? assetValueAt(entry, Math.max(0, entry.range.start))
}

/** Taxable gain when an asset is sold in year `index`, after the home-sale exclusion. */
export function saleGainFor(entry: AssetEntry, index: number, rules: SaleTaxRules): number {
  const { asset, range } = entry
  const gain = assetValueAt(entry, index) - assetBasis(entry)
  const ownedYears = index - Math.max(0, range.start)
  const exclusion =
    livesIn(asset) && ownedYears >= EXCLUSION_MIN_YEARS
      ? rules.joint
        ? HOME_SALE_EXCLUSION.joint
        : HOME_SALE_EXCLUSION.single
      : 0
  return Math.max(0, gain - exclusion)
}

/**
 * Sold within a year of buying it. Assets owned when the plan starts count as long-term, and
 * inherited ones always are.
 */
export function isShortTermSale(asset: PlanAsset, range: ResolvedRange, index: number): boolean {
  return range.start > 0 && asset.acquired !== "received" && index - range.start < 1
}

/** Capital-gains tax when an asset is sold in year `index`, after the home-sale exclusion. */
export function saleTaxFor(entry: AssetEntry, index: number, rules: SaleTaxRules): number {
  const rate = isShortTermSale(entry.asset, entry.range, index) ? rules.incomeTaxRate : rules.capitalGainsRate
  return saleGainFor(entry, index, rules) * rate
}

/**
 * Start-of-year events for year `index`: debts that start this year, asset purchases (net of debts
 * financing them; received assets cost nothing) and asset sales (net of the debts they pay off,
 * with capital-gains tax on the gain).
 */
export function applyAssetEvents(
  assets: AssetEntry[],
  debts: DebtEntry[],
  debtBalances: Record<string, number>,
  index: number,
  rules: SaleTaxRules,
): AssetEvents {
  let balances = { ...debtBalances }
  for (const { debt, start } of debts) {
    if (start === index) balances = { ...balances, [debt.id]: debt.balance }
  }
  let purchases = 0
  let sales = 0
  let saleTax = 0
  let saleGains = 0
  let saleRealEstateGains = 0
  let saleShortGains = 0
  for (const entry of assets) {
    const { asset, range } = entry
    const linked = debts.filter((d) => d.debt.assetId === asset.id)
    if (range.start > 0 && range.start === index && asset.acquired !== "received") {
      const financed = linked.filter((d) => d.start === index).reduce((s, d) => s + d.debt.balance, 0)
      purchases += Math.max(0, assetValueAt(entry, index) - financed)
    }
    if (range.end === index && range.end > Math.max(0, range.start)) {
      const owed = linked.reduce((s, d) => s + (balances[d.debt.id] ?? 0), 0)
      sales += assetValueAt(entry, index) - owed
      const gain = saleGainFor(entry, index, rules)
      if (isShortTermSale(asset, range, index)) saleShortGains += gain
      else {
        saleGains += gain
        if (asset.kind === "home") saleRealEstateGains += gain
      }
      saleTax += saleTaxFor(entry, index, rules)
      for (const d of linked) balances = { ...balances, [d.debt.id]: 0 }
    }
  }
  return { debtBalances: balances, purchases, sales, saleTax, saleGains, saleRealEstateGains, saleShortGains }
}

/** Pay every active debt for the year. */
export function payDebts(
  debts: DebtEntry[],
  debtBalances: Record<string, number>,
  index: number,
): { debtBalances: Record<string, number>; paid: number; interest: number; paidBy: Record<string, number>; interestBy: Record<string, number> } {
  let balances = { ...debtBalances }
  const paidBy: Record<string, number> = {}
  const interestBy: Record<string, number> = {}
  for (const { debt, start } of debts) {
    const balance = balances[debt.id] ?? 0
    if (start > index || balance <= 0) continue
    const year = amortizeYear(balance, debt.rate, debt.monthlyPayment)
    balances = { ...balances, [debt.id]: year.balance }
    paidBy[debt.id] = year.paid
    interestBy[debt.id] = year.interest
  }
  const total = (by: Record<string, number>) => Object.values(by).reduce((s, v) => s + v, 0)
  return { debtBalances: balances, paid: total(paidBy), interest: total(interestBy), paidBy, interestBy }
}

/** Change in value this year of assets held all year, split into gains and losses. */
export function assetValueChange(assets: AssetEntry[], index: number): { appreciation: number; depreciation: number } {
  let appreciation = 0
  let depreciation = 0
  for (const entry of assets) {
    if (!isOwned(entry.range, index)) continue
    const change = assetValueAt(entry, index + 1) - assetValueAt(entry, index)
    if (change >= 0) appreciation += change
    else depreciation -= change
  }
  return { appreciation, depreciation }
}

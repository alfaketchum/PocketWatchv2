import type { PlanDocument } from "../plan-types"
import { gainsRate, type Holdings } from "./engine-cashflow"

export interface TradingYear {
  holdings: Holdings
  /** Gains realized by trading this year, by holding period. */
  shortGains: number
  longGains: number
  /** Tax at this year's rates; under brackets the year-end true-up settles the exact amount. */
  tax: number
}

/**
 * Active trading: each taxable account realizes `realizedShare` of this year's growth. It's taxed now
 * and reinvested, so it joins the cost basis and isn't taxed again on withdrawal. Losses aren't harvested.
 */
export function realizeTrading(before: Holdings, grown: Holdings, doc: PlanDocument): TradingYear {
  let basis = grown.basis
  let shortGains = 0
  let longGains = 0
  let tax = 0
  for (const account of doc.accounts) {
    const share = account.realizedShare ?? 0
    if (account.taxTreatment !== "taxable" || share <= 0) continue
    const gain = (grown.balances[account.id] ?? 0) - (before.balances[account.id] ?? 0)
    if (gain <= 0) continue
    const realized = gain * share
    const short = account.shortTermShare ?? 0
    shortGains += realized * short
    longGains += realized * (1 - short)
    tax += realized * gainsRate(account, doc)
    basis = { ...basis, [account.id]: (basis[account.id] ?? 0) + realized }
  }
  return { holdings: { ...grown, basis }, shortGains, longGains, tax }
}

import { realRate } from "../plan-dollars"
import type { AccountMix, PlanAccount } from "../plan-types"

export const DEFAULT_STOCK_SHARE = 0.8
/** Crypto swings this many times as hard as US stocks, around its own assumed return. */
export const CRYPTO_BETA = 2
/** Worst crypto year allowed (−90%). */
const CRYPTO_FLOOR = -0.9
/** A single company's stock swings this many times as hard as the market, around its own assumed growth. */
export const SINGLE_STOCK_BETA = 1.5
/** Worst single-stock year allowed (−90%). */
const SINGLE_STOCK_FLOOR = -0.9

export const MIX_KEYS = ["stocks", "bonds", "cash", "crypto"] as const

/** What an account holds when no mix is set: crypto is crypto, cash is cash, everything else 80/20 stocks/bonds. */
export function defaultMix(account: Pick<PlanAccount, "source" | "taxTreatment">): AccountMix {
  if (account.source?.kind === "crypto") return { stocks: 0, bonds: 0, cash: 0, crypto: 1 }
  if (account.taxTreatment === "cash") return { stocks: 0, bonds: 0, cash: 1, crypto: 0 }
  return { stocks: DEFAULT_STOCK_SHARE, bonds: 1 - DEFAULT_STOCK_SHARE, cash: 0, crypto: 0 }
}

/** The account's mix scaled to add up to 1 (edits may not, until saved); the default when unset or empty. */
export function mixFor(account: PlanAccount): AccountMix {
  const mix = account.mix
  const total = mix ? MIX_KEYS.reduce((s, k) => s + mix[k], 0) : 0
  if (!mix || total <= 0) return defaultMix(account)
  return { stocks: mix.stocks / total, bonds: mix.bonds / total, cash: mix.cash / total, crypto: mix.crypto / total }
}

export interface MarketYear {
  stockReal: number
  bondReal: number
  /** Long-run average of ln(1 + real stock return) (crypto's swings are measured from it). */
  stockLogMean: number
}

/**
 * An account's nominal return in one historical year, in the plan's terms: stocks and bonds earn that year's
 * real return, cash earns nothing real (ERN's convention), and crypto earns its own assumed real return with
 * twice the stock market's swing that year, never worse than −90%. Swings are doubled in log terms so crypto's
 * long-run compounded return stays at its assumption (doubling plain returns would drag it far below, since
 * bigger swings compound to less). Real and nominal never mix: crypto's assumed nominal return is made real at
 * the plan's single rate (`assumedInflation`), and the year's real total is made nominal at that year's
 * inflation (`yearInflation`; the same number unless the plan follows the market year by year).
 */
export function yearReturn(account: PlanAccount, market: MarketYear, yearInflation: number, assumedInflation = yearInflation): number {
  const mix = mixFor(account)
  const swing = amplifiedSwing(market, CRYPTO_BETA)
  const cryptoReal = Math.max(CRYPTO_FLOOR, (1 + realRate(account.returnRate, assumedInflation)) * swing - 1)
  const real = mix.stocks * market.stockReal + mix.bonds * market.bondReal + mix.crypto * cryptoReal
  return (1 + real) * (1 + yearInflation) - 1
}

/** The market's swing that year, amplified `beta` times in log terms around its long-run average. */
function amplifiedSwing(market: MarketYear, beta: number): number {
  return Math.exp(beta * (Math.log(1 + market.stockReal) - market.stockLogMean))
}

/**
 * The stock behind an equity grant in one historical year: its own assumed growth (the income's growth; null
 * follows inflation, so no real growth) with 1.5× the market's swing, never worse than −90%. Like crypto, only
 * market-wide swings are replayed, not one company's own surprises.
 */
export function equityYearReturn(growth: number | null, market: MarketYear, yearInflation: number, assumedInflation = yearInflation): number {
  const assumedReal = growth === null ? 0 : realRate(growth, assumedInflation)
  const real = Math.max(SINGLE_STOCK_FLOOR, (1 + assumedReal) * amplifiedSwing(market, SINGLE_STOCK_BETA) - 1)
  return (1 + real) * (1 + yearInflation) - 1
}

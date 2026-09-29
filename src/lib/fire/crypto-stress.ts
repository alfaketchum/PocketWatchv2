/**
 * Crypto can't enter the ERN engine as a return series (≈11 years of history vs 1871+),
 * so it is modeled as a stress on the portfolio: each tier drops by a data-backed amount,
 * either counted today (risk-weighted value) or the month you retire (sequence-risk worst case).
 */
import { CRYPTO_TIERS, RISK_TIERS, type CryptoTier, type RiskTier } from "./crypto-tiers"
import { failsafe, successRate, summarizeCohorts } from "./swr-simulation"
import { yearsToTarget } from "./fire-projection"
import type { CryptoStressPreset, MarketHistory, SimOptions } from "./fire-types"

export type TierDrops = Record<RiskTier, number>

/**
 * Cautious: roughly each tier's worst historical drawdown (monthly data 2015–2026:
 * BTC −83%, ETH −93%; 2018/2021 top-20 cohorts median −77%/−93%, worst drawdowns −96%).
 */
export const CRYPTO_PRESETS: Record<Exclude<CryptoStressPreset, "custom">, TierDrops> = {
  cautious: { btc: 0.75, eth: 0.85, top100: 0.9, longTail: 1 },
  moderate: { btc: 0.5, eth: 0.6, top100: 0.8, longTail: 1 },
  full: { btc: 0, eth: 0, top100: 0, longTail: 0 },
}

export const CRYPTO_PRESET_LABELS: Record<CryptoStressPreset, string> = {
  cautious: "Cautious",
  moderate: "Moderate",
  full: "Full value",
  custom: "Custom",
}

export function resolveDrops(preset: CryptoStressPreset, custom: TierDrops): TierDrops {
  return preset === "custom" ? custom : CRYPTO_PRESETS[preset]
}

/** Rescale tier dollars to the headline crypto total; the tier split supplies proportions only. */
export function scaleTiers(tiers: Record<CryptoTier, number>, total: number): Record<CryptoTier, number> {
  const sum = CRYPTO_TIERS.reduce((s, t) => s + tiers[t], 0)
  if (sum <= 0 || total <= 0) return { btc: 0, eth: 0, top100: 0, longTail: 0, stable: 0 }
  const k = total / sum
  return Object.fromEntries(CRYPTO_TIERS.map((t) => [t, tiers[t] * k])) as Record<CryptoTier, number>
}

/** Dollars lost if every tier drops by its stress amount. */
export function cryptoLoss(tiers: Record<CryptoTier, number>, drops: TierDrops): number {
  return RISK_TIERS.reduce((s, t) => s + tiers[t] * drops[t], 0)
}

/** Crypto counted at its stressed value (stablecoins at face value). */
export function riskWeightedCrypto(tiers: Record<CryptoTier, number>, drops: TierDrops): number {
  return CRYPTO_TIERS.reduce((s, t) => s + tiers[t], 0) - cryptoLoss(tiers, drops)
}

export interface CrashResult {
  /** Share of the retirement portfolio lost in the crash. */
  lossFraction: number
  withdrawalRate: number
  successRate: number | null
  /** Spending the worst historical cohort could sustain from the post-crash portfolio. */
  safeSpend: number | null
}

/**
 * ERN-style worst case: crypto crashes the month you retire, then the remaining portfolio
 * runs through the historical simulation. Crypto's share at retirement is assumed equal to today's.
 */
export function crashAtRetirement(
  history: MarketHistory,
  opts: SimOptions,
  portfolio: number,
  annualSpend: number,
  lossFraction: number,
): CrashResult {
  const after = portfolio * (1 - Math.min(1, Math.max(0, lossFraction)))
  if (after <= 0) return { lossFraction, withdrawalRate: Infinity, successRate: 0, safeSpend: 0 }
  const wr = annualSpend / after
  const worst = failsafe(summarizeCohorts(history, opts))
  return {
    lossFraction,
    withdrawalRate: wr,
    successRate: successRate(history, wr, opts),
    safeSpend: worst ? worst.wr * after : null,
  }
}

export interface CryptoStressSummary {
  drops: TierDrops
  tiers: Record<CryptoTier, number>
  /** Dollars lost if every tier drops by its stress amount today. */
  loss: number
  riskWeighted: number
  /** Loss as a share of the whole investable portfolio (applied at retirement too). */
  lossFraction: number
  /** Years to FI counting crypto at its risk-weighted value. */
  stressedYears: number | null
}

/** Risk-weighted view of today's portfolio: same target, crypto counted after its stress drop. */
export function stressSummary(
  tiers: Record<CryptoTier, number>,
  drops: TierDrops,
  plan: { investable: number; annualContribution: number },
  target: number,
  realReturn: number,
): CryptoStressSummary {
  const loss = cryptoLoss(tiers, drops)
  return {
    drops,
    tiers,
    loss,
    riskWeighted: riskWeightedCrypto(tiers, drops),
    lossFraction: plan.investable > 0 ? Math.min(1, loss / plan.investable) : 0,
    stressedYears: yearsToTarget(Math.max(0, plan.investable - loss), plan.annualContribution, realReturn, target),
  }
}

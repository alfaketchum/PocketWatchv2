/**
 * Loan rates by credit score. Mortgages: Curinos via Experian, September 2026 (30-year fixed, $350,000 loan,
 * 30-day lock; 15-year barely varies). Car loans: Experian State of the Automotive Finance Market, Q2 2026.
 */

export interface ScoreStep {
  /** Lowest score the rate applies to. */
  min: number
  rate: number
}

/** 30-year fixed by FICO score, best first. Below 620 most conventional lenders won't lend; 620's rate is used. */
export const MORTGAGE_SCORE_STEPS: ScoreStep[] = [
  { min: 780, rate: 0.0685 },
  { min: 760, rate: 0.0693 },
  { min: 740, rate: 0.0699 },
  { min: 720, rate: 0.071 },
  { min: 700, rate: 0.0714 },
  { min: 680, rate: 0.0725 },
  { min: 660, rate: 0.0731 },
  { min: 640, rate: 0.0745 },
  { min: 620, rate: 0.0761 },
]

/** 15-year fixed by FICO score: almost flat. */
const MORTGAGE_15_STEPS: ScoreStep[] = [
  { min: 760, rate: 0.0629 },
  { min: 740, rate: 0.063 },
  { min: 700, rate: 0.0631 },
  { min: 680, rate: 0.0633 },
  { min: 660, rate: 0.0631 },
  { min: 640, rate: 0.0632 },
  { min: 620, rate: 0.0633 },
]

/** Lowest score most conventional mortgage lenders accept. */
export const MORTGAGE_MIN_SCORE = 620

/** The plan's typical mortgage rates stand for this score (a typical conventional borrower). */
export const REFERENCE_SCORE = 740

export interface AutoTier {
  min: number
  label: string
  newRate: number
  usedRate: number
}

export const AUTO_TIERS: AutoTier[] = [
  { min: 781, label: "Super prime", newRate: 0.0441, usedRate: 0.0629 },
  { min: 661, label: "Prime", newRate: 0.0615, usedRate: 0.0881 },
  { min: 601, label: "Near prime", newRate: 0.0971, usedRate: 0.1393 },
  { min: 501, label: "Subprime", newRate: 0.1352, usedRate: 0.191 },
  { min: 300, label: "Deep subprime", newRate: 0.1611, usedRate: 0.2162 },
]

function stepAt(steps: ScoreStep[], score: number): number {
  return (steps.find((s) => score >= s.min) ?? steps[steps.length - 1]).rate
}

/** Typical mortgage rate at a score: the 15-year table for terms of 15 years or less, else the 30-year. */
export function mortgageRateAt(score: number, termYears = 30): number {
  return stepAt(termYears <= 15 ? MORTGAGE_15_STEPS : MORTGAGE_SCORE_STEPS, score)
}

/** How much a score moves a typical mortgage rate from the reference borrower's (negative = cheaper). */
export function mortgageAdjustment(score: number, termYears = 30): number {
  return mortgageRateAt(score, termYears) - mortgageRateAt(REFERENCE_SCORE, termYears)
}

export function autoTierAt(score: number): AutoTier {
  return AUTO_TIERS.find((t) => score >= t.min) ?? AUTO_TIERS[AUTO_TIERS.length - 1]
}

/** Typical car loan rate at a score, new or used. */
export function autoRateAt(score: number, used: boolean): number {
  const tier = autoTierAt(score)
  return used ? tier.usedRate : tier.newRate
}

import type { Brackets, FilingStatus } from "./federal-2026"

/**
 * States that tax capital gains differently from other income (2026). Every other state taxes
 * short- and long-term gains as ordinary income. Simplified: holding-period, asset-type and
 * in-state-business conditions beyond those noted aren't modeled.
 */
export type StateGainsRule =
  /** A share of long-term gains is excluded (AR 50%, AZ 25%, ND 40%, SC 44%, WI 30%). */
  | { kind: "exclude"; share: number }
  /** A fixed amount of long-term gains is deducted (NM $2,500, VT $5,000). */
  | { kind: "deduct"; amount: number }
  /** Long-term gains are taxed at no more than this rate (HI 7.25%). */
  | { kind: "maxRate"; rate: number }
  /** Long-term gains have their own brackets, stacked on other taxable income (MT 3% / 4.1%). */
  | { kind: "separate"; brackets: Record<FilingStatus, Brackets> }
  /** Short-term gains are taxed at a higher rate than other income (MA 8.5% vs 5%): the extra. */
  | { kind: "shortSurcharge"; extra: number }
  /**
   * No income tax, but a tax on long-term gains above a deduction, excluding real estate (WA: 7%,
   * 9.9% above $1M). The deduction is 2025's $278,000, one per return.
   */
  | { kind: "gainsOnly"; deduction: number; brackets: Brackets }

export const STATE_GAINS: Record<string, StateGainsRule> = {
  AR: { kind: "exclude", share: 0.5 },
  AZ: { kind: "exclude", share: 0.25 },
  ND: { kind: "exclude", share: 0.4 },
  SC: { kind: "exclude", share: 0.44 },
  WI: { kind: "exclude", share: 0.3 },
  NM: { kind: "deduct", amount: 2_500 },
  VT: { kind: "deduct", amount: 5_000 },
  HI: { kind: "maxRate", rate: 0.0725 },
  MT: { kind: "separate", brackets: { single: [[0, 0.03], [47_500, 0.041]], joint: [[0, 0.03], [95_000, 0.041]] } },
  MA: { kind: "shortSurcharge", extra: 0.085 - 0.05 },
  WA: { kind: "gainsOnly", deduction: 278_000, brackets: [[0, 0.07], [1_000_000, 0.099]] },
}

/** One line for the UI on how the state treats gains. */
export function stateGainsNote(state: string | null): string | null {
  const rule = state ? STATE_GAINS[state] : undefined
  if (!rule) return null
  const pct = (n: number) => `${+(n * 100).toFixed(2)}%`
  switch (rule.kind) {
    case "exclude":
      return `${pct(rule.share)} of long-term gains excluded.`
    case "deduct":
      return `First $${rule.amount.toLocaleString()} of long-term gains deducted.`
    case "maxRate":
      return `Long-term gains capped at ${pct(rule.rate)}.`
    case "separate":
      return "Long-term gains taxed at 3% / 4.1%."
    case "shortSurcharge":
      return "Short-term gains taxed at 8.5%."
    case "gainsOnly":
      return "No income tax; 7% on long-term gains over $278k (9.9% over $1M), real estate exempt."
  }
}

/**
 * 2026 US federal income tax (IRS Rev. Proc. 2025-32). Thresholds are in 2026 dollars; the engine
 * grows them with the plan's inflation, as the IRS indexes them yearly.
 */
export const TAX_BASE_YEAR = 2026

export type FilingStatus = "single" | "joint"

/** [lower threshold, rate] pairs, ascending. */
export type Brackets = readonly (readonly [number, number])[]

export const FEDERAL_ORDINARY: Record<FilingStatus, Brackets> = {
  single: [
    [0, 0.1],
    [12_400, 0.12],
    [50_400, 0.22],
    [105_700, 0.24],
    [201_775, 0.32],
    [256_225, 0.35],
    [640_600, 0.37],
  ],
  joint: [
    [0, 0.1],
    [24_800, 0.12],
    [100_800, 0.22],
    [211_400, 0.24],
    [403_550, 0.32],
    [512_450, 0.35],
    [768_700, 0.37],
  ],
}

export const FEDERAL_STANDARD_DEDUCTION: Record<FilingStatus, number> = { single: 16_100, joint: 32_200 }

/** Long-term capital gains and qualified dividends: 0 / 15 / 20%, stacked on top of ordinary income. */
export const FEDERAL_LTCG: Record<FilingStatus, Brackets> = {
  single: [
    [0, 0],
    [49_450, 0.15],
    [545_500, 0.2],
  ],
  joint: [
    [0, 0],
    [98_900, 0.15],
    [613_700, 0.2],
  ],
}

/** Share of Social Security benefits taxed at most (the usual case once other income is meaningful). */
export const SOCIAL_SECURITY_TAXABLE_SHARE = 0.85

/** Net investment income tax: 3.8% on investment income above these (not inflation-indexed) MAGI lines. */
export const NIIT_RATE = 0.038
export const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200_000, joint: 250_000 }

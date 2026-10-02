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

/** Extra standard deduction for each filer 65 or older: unmarried, or per spouse on a joint return (indexed). */
export const FEDERAL_AGED_ADDITION: Record<FilingStatus, number> = { single: 2_050, joint: 1_650 }

/**
 * Senior deduction (One Big Beautiful Bill Act): $6,000 per filer 65 or older, tax years 2025–2028, taken whether
 * or not you itemize. Each $6,000 shrinks by 6% of MAGI over the threshold. Not indexed.
 */
export const SENIOR_DEDUCTION = {
  amount: 6_000,
  firstYear: 2025,
  lastYear: 2028,
  phaseOutRate: 0.06,
  threshold: { single: 75_000, joint: 150_000 } as Record<FilingStatus, number>,
}

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

/**
 * Alternative minimum tax (Rev. Proc. 2025-32 §.10, with the One Big Beautiful Bill's 50% phase-out). The exemption
 * shrinks by half of AMT income over the phase-out line (gone at $680,200 single, $1,280,400 joint); 26% applies up
 * to the 28% line. Long-term gains keep their 0 / 15 / 20% rates.
 */
export const AMT_EXEMPTION: Record<FilingStatus, number> = { single: 90_100, joint: 140_200 }
export const AMT_PHASEOUT_START: Record<FilingStatus, number> = { single: 500_000, joint: 1_000_000 }
export const AMT_PHASEOUT_RATE = 0.5
export const AMT_RATES: Brackets = [
  [0, 0.26],
  [244_500, 0.28],
]

/** Net investment income tax: 3.8% on investment income above these (not inflation-indexed) MAGI lines. */
export const NIIT_RATE = 0.038
export const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200_000, joint: 250_000 }

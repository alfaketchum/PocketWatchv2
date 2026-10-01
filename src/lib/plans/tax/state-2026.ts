import type { Brackets, FilingStatus } from "./federal-2026"

/**
 * 2026 state individual income tax (Tax Foundation, "2026 State Income Tax Rates and Brackets").
 * Flat-tax states' standard deductions / personal exemptions: AZ and ID follow the federal standard
 * deduction; GA $12k/$24k, NC $12,750/$25,500, LA $12,500/$25,000 (2025 reform), KY $3,270 each, MS $2,300
 * standard + $6,000 exemption (single), MI $5,800 / IL $2,850 / IN $1,000 per person exemptions. CO and IA
 * start from federal taxable income (see state-homeowner-2026.ts); PA and UT have none.
 * Simplified: deductions and exemptions are subtracted when they're deductions (credits are ignored),
 * capital gains follow state-gains-2026.ts, and retirement-income or Social Security exclusions,
 * local taxes and credits are not modeled.
 */
export interface StateTax {
  name: string
  kind: "none" | "flat" | "brackets"
  /** Flat states. */
  rate?: number
  brackets?: Record<FilingStatus, Brackets>
  /** Standard deduction plus personal exemption, when they're deductions. */
  deduction?: Record<FilingStatus, number>
}

const same = (b: Brackets): Record<FilingStatus, Brackets> => ({ single: b, joint: b })
const ded = (single: number, joint: number): Record<FilingStatus, number> => ({ single, joint })

export const STATE_TAX: Record<string, StateTax> = {
  AL: { name: "Alabama", kind: "brackets", brackets: { single: [[0, 0.02], [500, 0.04], [3_000, 0.05]], joint: [[0, 0.02], [1_000, 0.04], [6_000, 0.05]] }, deduction: ded(4_500, 11_500) },
  AK: { name: "Alaska", kind: "none" },
  AZ: { name: "Arizona", kind: "flat", rate: 0.025, deduction: ded(16_100, 32_200) },
  AR: { name: "Arkansas", kind: "brackets", brackets: same([[0, 0.02], [4_600, 0.039]]), deduction: ded(2_470, 4_940) },
  CA: {
    name: "California",
    kind: "brackets",
    brackets: {
      single: [[0, 0.01], [11_079, 0.02], [26_264, 0.04], [41_452, 0.06], [57_542, 0.08], [72_724, 0.093], [371_479, 0.103], [445_771, 0.113], [742_953, 0.123], [1_000_000, 0.133]],
      joint: [[0, 0.01], [22_158, 0.02], [52_528, 0.04], [82_904, 0.06], [115_084, 0.08], [145_448, 0.093], [742_958, 0.103], [891_542, 0.113], [1_000_000, 0.123], [1_485_906, 0.133]],
    },
    deduction: ded(5_540, 11_080),
  },
  CO: { name: "Colorado", kind: "flat", rate: 0.044 },
  CT: {
    name: "Connecticut",
    kind: "brackets",
    brackets: {
      single: [[0, 0.02], [10_000, 0.045], [50_000, 0.055], [100_000, 0.06], [200_000, 0.065], [250_000, 0.069], [500_000, 0.0699]],
      joint: [[0, 0.02], [20_000, 0.045], [100_000, 0.055], [200_000, 0.06], [400_000, 0.065], [500_000, 0.069], [1_000_000, 0.0699]],
    },
    deduction: ded(15_000, 24_000),
  },
  DE: { name: "Delaware", kind: "brackets", brackets: same([[0, 0], [2_000, 0.022], [5_000, 0.039], [10_000, 0.048], [20_000, 0.052], [25_000, 0.0555], [60_000, 0.066]]), deduction: ded(3_250, 6_500) },
  DC: { name: "District of Columbia", kind: "brackets", brackets: same([[0, 0.04], [10_000, 0.06], [40_000, 0.065], [60_000, 0.085], [250_000, 0.0925], [500_000, 0.0975], [1_000_000, 0.1075]]), deduction: ded(16_100, 32_200) },
  FL: { name: "Florida", kind: "none" },
  GA: { name: "Georgia", kind: "flat", rate: 0.0519, deduction: ded(12_000, 24_000) },
  HI: {
    name: "Hawaii",
    kind: "brackets",
    brackets: {
      single: [[0, 0.014], [9_600, 0.032], [14_400, 0.055], [19_200, 0.064], [24_000, 0.068], [36_000, 0.072], [48_000, 0.076], [125_000, 0.079], [175_000, 0.0825], [225_000, 0.09], [275_000, 0.1], [325_000, 0.11]],
      joint: [[0, 0.014], [19_200, 0.032], [28_800, 0.055], [38_400, 0.064], [48_000, 0.068], [72_000, 0.072], [96_000, 0.076], [250_000, 0.079], [350_000, 0.0825], [450_000, 0.09], [550_000, 0.1], [650_000, 0.11]],
    },
    deduction: ded(5_544, 11_088),
  },
  ID: { name: "Idaho", kind: "flat", rate: 0.053, deduction: ded(16_100, 32_200) },
  IL: { name: "Illinois", kind: "flat", rate: 0.0495, deduction: ded(2_850, 5_700) },
  IN: { name: "Indiana", kind: "flat", rate: 0.0295, deduction: ded(1_000, 2_000) },
  IA: { name: "Iowa", kind: "flat", rate: 0.038 },
  KS: { name: "Kansas", kind: "brackets", brackets: { single: [[0, 0.052], [23_000, 0.0558]], joint: [[0, 0.052], [46_000, 0.0558]] }, deduction: ded(12_765, 26_560) },
  KY: { name: "Kentucky", kind: "flat", rate: 0.035, deduction: ded(3_270, 6_540) },
  LA: { name: "Louisiana", kind: "flat", rate: 0.03, deduction: ded(12_500, 25_000) },
  ME: { name: "Maine", kind: "brackets", brackets: { single: [[0, 0.058], [27_399, 0.0675], [64_849, 0.0715]], joint: [[0, 0.058], [54_849, 0.0675], [129_749, 0.0715]] }, deduction: ded(13_650, 27_300) },
  MD: {
    name: "Maryland",
    kind: "brackets",
    brackets: {
      single: [[0, 0.02], [1_000, 0.03], [2_000, 0.04], [3_000, 0.0475], [100_000, 0.05], [125_000, 0.0525], [150_000, 0.055], [250_000, 0.0575], [500_000, 0.0625], [1_000_000, 0.065]],
      joint: [[0, 0.02], [1_000, 0.03], [2_000, 0.04], [3_000, 0.0475], [150_000, 0.05], [175_000, 0.0525], [225_000, 0.055], [300_000, 0.0575], [600_000, 0.0625], [1_200_000, 0.065]],
    },
    deduction: ded(6_550, 13_100),
  },
  MA: { name: "Massachusetts", kind: "brackets", brackets: same([[0, 0.05], [1_083_150, 0.09]]), deduction: ded(4_400, 8_800) },
  MI: { name: "Michigan", kind: "flat", rate: 0.0425, deduction: ded(5_800, 11_600) },
  MN: {
    name: "Minnesota",
    kind: "brackets",
    brackets: { single: [[0, 0.0535], [33_310, 0.068], [109_430, 0.0785], [203_150, 0.0985]], joint: [[0, 0.0535], [48_700, 0.068], [193_480, 0.0785], [337_930, 0.0985]] },
    deduction: ded(15_300, 30_600),
  },
  MS: { name: "Mississippi", kind: "flat", rate: 0.04, deduction: ded(8_300, 16_600) },
  MO: { name: "Missouri", kind: "brackets", brackets: same([[0, 0], [1_348, 0.02], [2_696, 0.025], [4_044, 0.03], [5_392, 0.035], [6_740, 0.04], [8_088, 0.045], [9_436, 0.047]]), deduction: ded(16_100, 32_200) },
  MT: { name: "Montana", kind: "brackets", brackets: { single: [[0, 0.047], [47_500, 0.0565]], joint: [[0, 0.047], [95_000, 0.0565]] }, deduction: ded(16_100, 32_200) },
  NE: { name: "Nebraska", kind: "brackets", brackets: { single: [[0, 0.0246], [4_130, 0.0351], [24_760, 0.0455]], joint: [[0, 0.0246], [8_250, 0.0351], [49_530, 0.0455]] }, deduction: ded(8_850, 17_700) },
  NV: { name: "Nevada", kind: "none" },
  NH: { name: "New Hampshire", kind: "none" },
  NJ: {
    name: "New Jersey",
    kind: "brackets",
    brackets: {
      single: [[0, 0.014], [20_000, 0.0175], [35_000, 0.035], [40_000, 0.0553], [75_000, 0.0637], [500_000, 0.0897], [1_000_000, 0.1075]],
      joint: [[0, 0.014], [20_000, 0.0175], [50_000, 0.0245], [70_000, 0.035], [80_000, 0.0553], [150_000, 0.0637], [500_000, 0.0897], [1_000_000, 0.1075]],
    },
    deduction: ded(1_000, 2_000),
  },
  NM: {
    name: "New Mexico",
    kind: "brackets",
    brackets: { single: [[0, 0.015], [5_500, 0.032], [16_500, 0.043], [33_500, 0.047], [66_500, 0.049], [210_000, 0.059]], joint: [[0, 0.015], [8_000, 0.032], [25_000, 0.043], [50_000, 0.047], [100_000, 0.049], [315_000, 0.059]] },
    deduction: ded(16_100, 32_200),
  },
  NY: {
    name: "New York",
    kind: "brackets",
    brackets: {
      single: [[0, 0.039], [8_500, 0.044], [11_700, 0.0515], [13_900, 0.054], [80_650, 0.059], [215_400, 0.0685], [1_077_550, 0.0965], [5_000_000, 0.103], [25_000_000, 0.109]],
      joint: [[0, 0.039], [17_150, 0.044], [23_600, 0.0515], [27_900, 0.054], [161_550, 0.059], [323_200, 0.0685], [2_155_350, 0.0965], [5_000_000, 0.103], [25_000_000, 0.109]],
    },
    deduction: ded(8_000, 16_050),
  },
  NC: { name: "North Carolina", kind: "flat", rate: 0.0399, deduction: ded(12_750, 25_500) },
  ND: { name: "North Dakota", kind: "brackets", brackets: { single: [[0, 0], [48_475, 0.0195], [244_825, 0.025]], joint: [[0, 0], [80_975, 0.0195], [298_075, 0.025]] }, deduction: ded(16_100, 32_200) },
  OH: { name: "Ohio", kind: "brackets", brackets: same([[0, 0], [26_050, 0.0275]]) },
  OK: { name: "Oklahoma", kind: "brackets", brackets: { single: [[0, 0], [3_750, 0.025], [4_900, 0.035], [7_200, 0.045]], joint: [[0, 0], [7_500, 0.025], [9_800, 0.035], [14_400, 0.045]] }, deduction: ded(7_350, 14_700) },
  OR: { name: "Oregon", kind: "brackets", brackets: { single: [[0, 0.0475], [4_550, 0.0675], [11_400, 0.0875], [125_000, 0.099]], joint: [[0, 0.0475], [9_100, 0.0675], [22_800, 0.0875], [250_000, 0.099]] }, deduction: ded(2_910, 5_820) },
  PA: { name: "Pennsylvania", kind: "flat", rate: 0.0307 },
  RI: { name: "Rhode Island", kind: "brackets", brackets: same([[0, 0.0375], [82_050, 0.0475], [186_450, 0.0599]]), deduction: ded(16_450, 32_900) },
  SC: { name: "South Carolina", kind: "brackets", brackets: same([[0, 0], [3_640, 0.03], [18_230, 0.06]]), deduction: ded(8_350, 16_700) },
  SD: { name: "South Dakota", kind: "none" },
  TN: { name: "Tennessee", kind: "none" },
  TX: { name: "Texas", kind: "none" },
  UT: { name: "Utah", kind: "flat", rate: 0.045 },
  VT: {
    name: "Vermont",
    kind: "brackets",
    brackets: { single: [[0, 0.0335], [49_400, 0.066], [119_700, 0.076], [249_700, 0.0875]], joint: [[0, 0.0335], [82_500, 0.066], [199_450, 0.076], [304_000, 0.0875]] },
    deduction: ded(12_950, 25_900),
  },
  VA: { name: "Virginia", kind: "brackets", brackets: same([[0, 0.02], [3_000, 0.03], [5_000, 0.05], [17_000, 0.0575]]), deduction: ded(9_680, 19_360) },
  WA: { name: "Washington", kind: "none" },
  WV: { name: "West Virginia", kind: "brackets", brackets: same([[0, 0.0222], [10_000, 0.0296], [25_000, 0.0333], [40_000, 0.0444], [60_000, 0.0482]]), deduction: ded(2_000, 4_000) },
  WI: { name: "Wisconsin", kind: "brackets", brackets: { single: [[0, 0.035], [15_110, 0.044], [51_950, 0.053], [332_720, 0.0765]], joint: [[0, 0.035], [20_150, 0.044], [69_260, 0.053], [443_630, 0.0765]] }, deduction: ded(14_660, 27_240) },
  WY: { name: "Wyoming", kind: "none" },
}

export const STATE_CODES = Object.keys(STATE_TAX).sort((a, b) => STATE_TAX[a].name.localeCompare(STATE_TAX[b].name))

/**
 * Long-term care costs by state, 2024 (Federal Long Term Care Insurance Program 2024 Cost of Care Survey,
 * data by illumifin from 32,000+ providers). The survey reports cities and regions; each state here is the
 * median of its regions. Nursing home: private room, daily rate × 365. Assisted living: one bedroom, monthly
 * rate × 12. Home health aide: hourly rate. Source: https://cdn.ltcfeds.gov/planning-tools/downloads/Cost-of-Care-Survey.pdf
 */

export interface CareCosts {
  /** Nursing home, private room, per year. */
  nursingHome: number
  /** Assisted living, one bedroom, per year. */
  assistedLiving: number
  /** Home health aide, per hour. */
  aideHourly: number
}

export const CARE_COST_YEAR = 2024

/** National averages from the same survey. */
export const NATIONAL_CARE_COSTS: CareCosts = { nursingHome: 127_020, assistedLiving: 66_132, aideHourly: 33 }

export const STATE_CARE_COSTS: Record<string, CareCosts> = {
  AK: { nursingHome: 150_902, assistedLiving: 87_906, aideHourly: 37.06 },
  AL: { nursingHome: 98_535, assistedLiving: 54_686, aideHourly: 26.44 },
  AR: { nursingHome: 90_210, assistedLiving: 49_207, aideHourly: 27.91 },
  AZ: { nursingHome: 127_976, assistedLiving: 64_560, aideHourly: 34.09 },
  CA: { nursingHome: 146_434, assistedLiving: 65_225, aideHourly: 35.61 },
  CO: { nursingHome: 117_986, assistedLiving: 68_597, aideHourly: 34.97 },
  CT: { nursingHome: 199_199, assistedLiving: 78_623, aideHourly: 35.6 },
  DC: { nursingHome: 183_785, assistedLiving: 106_665, aideHourly: 33.59 },
  DE: { nursingHome: 159_713, assistedLiving: 94_868, aideHourly: 33.27 },
  FL: { nursingHome: 130_911, assistedLiving: 60_239, aideHourly: 30.83 },
  GA: { nursingHome: 105_412, assistedLiving: 52_532, aideHourly: 29.05 },
  HI: { nursingHome: 196_060, assistedLiving: 81_937, aideHourly: 38.17 },
  IA: { nursingHome: 119_370, assistedLiving: 65_589, aideHourly: 34.33 },
  ID: { nursingHome: 123_487, assistedLiving: 56_198, aideHourly: 34.59 },
  IL: { nursingHome: 108_390, assistedLiving: 60_207, aideHourly: 31.43 },
  IN: { nursingHome: 127_078, assistedLiving: 60_536, aideHourly: 31.77 },
  KS: { nursingHome: 111_639, assistedLiving: 70_804, aideHourly: 30.16 },
  KY: { nursingHome: 124_428, assistedLiving: 52_233, aideHourly: 28.79 },
  LA: { nursingHome: 79_355, assistedLiving: 56_139, aideHourly: 25.86 },
  MA: { nursingHome: 167_422, assistedLiving: 88_553, aideHourly: 35.84 },
  MD: { nursingHome: 155_815, assistedLiving: 81_706, aideHourly: 33.62 },
  ME: { nursingHome: 136_390, assistedLiving: 83_246, aideHourly: 34.45 },
  MI: { nursingHome: 140_536, assistedLiving: 67_814, aideHourly: 34.08 },
  MN: { nursingHome: 163_867, assistedLiving: 57_139, aideHourly: 36.51 },
  MO: { nursingHome: 94_900, assistedLiving: 56_018, aideHourly: 29.6 },
  MS: { nursingHome: 110_526, assistedLiving: 54_063, aideHourly: 25.0 },
  MT: { nursingHome: 108_591, assistedLiving: 54_678, aideHourly: 37.27 },
  NC: { nursingHome: 120_862, assistedLiving: 62_257, aideHourly: 29.13 },
  ND: { nursingHome: 169_860, assistedLiving: 52_457, aideHourly: 34.36 },
  NE: { nursingHome: 130_268, assistedLiving: 65_471, aideHourly: 35.17 },
  NH: { nursingHome: 154_490, assistedLiving: 104_566, aideHourly: 39.75 },
  NJ: { nursingHome: 195_961, assistedLiving: 97_807, aideHourly: 35.54 },
  NM: { nursingHome: 109_682, assistedLiving: 61_475, aideHourly: 29.77 },
  NV: { nursingHome: 148_675, assistedLiving: 63_650, aideHourly: 36.83 },
  NY: { nursingHome: 164_801, assistedLiving: 70_415, aideHourly: 33.3 },
  OH: { nursingHome: 114_435, assistedLiving: 60_373, aideHourly: 29.62 },
  OK: { nursingHome: 92_250, assistedLiving: 56_464, aideHourly: 30.2 },
  OR: { nursingHome: 135_160, assistedLiving: 70_446, aideHourly: 33.63 },
  PA: { nursingHome: 151_103, assistedLiving: 68_404, aideHourly: 31.31 },
  RI: { nursingHome: 165_429, assistedLiving: 71_042, aideHourly: 36.58 },
  SC: { nursingHome: 114_636, assistedLiving: 57_939, aideHourly: 30.52 },
  SD: { nursingHome: 108_730, assistedLiving: 57_662, aideHourly: 40.45 },
  TN: { nursingHome: 117_424, assistedLiving: 62_765, aideHourly: 29.56 },
  TX: { nursingHome: 90_976, assistedLiving: 55_200, aideHourly: 28.5 },
  UT: { nursingHome: 122_724, assistedLiving: 55_490, aideHourly: 33.78 },
  VA: { nursingHome: 126_100, assistedLiving: 69_128, aideHourly: 32.62 },
  VT: { nursingHome: 161_863, assistedLiving: 79_541, aideHourly: 39.02 },
  WA: { nursingHome: 140_299, assistedLiving: 70_482, aideHourly: 36.73 },
  WI: { nursingHome: 134_846, assistedLiving: 63_321, aideHourly: 33.27 },
  WV: { nursingHome: 115_924, assistedLiving: 68_170, aideHourly: 28.46 },
  WY: { nursingHome: 114_683, assistedLiving: 56_601, aideHourly: 32.95 },
}

/** Costs where the parent lives (a state code), or national averages when unknown. */
export function careCostsFor(state: string | null | undefined): CareCosts {
  return (state && STATE_CARE_COSTS[state]) || NATIONAL_CARE_COSTS
}

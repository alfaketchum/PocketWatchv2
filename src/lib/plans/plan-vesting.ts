import type { VestingSchedule } from "./plan-types"

const MONTHS = 12

/** Ready-made schedules: each year's share of the grant. Custom edits the shares directly. */
export const VESTING_PRESETS = [
  { key: "even4", label: "Even over 4 years", yearly: [0.25, 0.25, 0.25, 0.25] },
  { key: "even3", label: "Even over 3 years", yearly: [1 / 3, 1 / 3, 1 / 3] },
  { key: "front", label: "Front-loaded (33/33/22/12)", yearly: [0.33, 0.33, 0.22, 0.12] },
  { key: "back", label: "Back-loaded (10/20/30/40)", yearly: [0.1, 0.2, 0.3, 0.4] },
  { key: "amazon", label: "Back-loaded (5/15/40/40)", yearly: [0.05, 0.15, 0.4, 0.4] },
] as const

export const VESTING_EVERY = [
  { value: 1, label: "Monthly" },
  { value: 3, label: "Quarterly" },
  { value: 6, label: "Every 6 months" },
  { value: 12, label: "Yearly" },
] as const

export const CLIFF_OPTIONS = [
  { value: 0, label: "No cliff" },
  { value: 6, label: "6 months" },
  { value: 12, label: "1 year" },
] as const

/** The usual grant: 4 years, a 1-year cliff, then monthly. */
export function defaultVesting(grantMonth: number): VestingSchedule {
  return { yearly: [...VESTING_PRESETS[0].yearly], cliffMonths: 12, every: 1, grantMonth, refresh: false }
}

/** The preset a schedule's yearly shares match, or null (custom). */
export function presetOf(schedule: VestingSchedule): string | null {
  const same = (a: readonly number[]) => a.length === schedule.yearly.length && a.every((v, i) => Math.abs(v - schedule.yearly[i]) < 1e-6)
  return VESTING_PRESETS.find((p) => same(p.yearly))?.key ?? null
}

/** Each year's shares scaled to add up to 1 (edits may not); empty or all-zero vests nothing. */
function normalized(yearly: number[]): number[] {
  const total = yearly.reduce((s, v) => s + Math.max(0, v), 0)
  return total > 0 ? yearly.map((v) => Math.max(0, v) / total) : yearly.map(() => 0)
}

/** Share of the grant vesting at each month after the grant (index = months since; 0 is unused). */
function monthlyVests(schedule: VestingSchedule): number[] {
  const yearly = normalized(schedule.yearly)
  const vests = new Array<number>(yearly.length * MONTHS + 1).fill(0)
  const per = MONTHS / schedule.every
  yearly.forEach((share, year) => {
    for (let step = 1; step <= per; step++) vests[year * MONTHS + step * schedule.every] += share / per
  })
  // Nothing vests before the cliff; what would have, vests at the cliff.
  const cliff = Math.min(schedule.cliffMonths, vests.length - 1)
  for (let m = 1; m < cliff; m++) {
    vests[cliff] += vests[m]
    vests[m] = 0
  }
  return vests
}

/**
 * Share of one grant vesting in each calendar year from the grant's year (index 0): months are counted from
 * the grant month, so a July grant with a 1-year cliff vests nothing in its first year and a lump the next July.
 */
export function vestingByYear(schedule: VestingSchedule): number[] {
  const months = monthlyVests(schedule)
  const years = new Array<number>(Math.ceil((schedule.grantMonth - 1 + months.length) / MONTHS)).fill(0)
  months.forEach((share, m) => {
    if (share > 0) years[Math.floor((schedule.grantMonth - 1 + m) / MONTHS)] += share
  })
  while (years.length > 1 && years[years.length - 1] === 0) years.pop()
  return years
}

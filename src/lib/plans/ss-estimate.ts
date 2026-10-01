/**
 * Estimating a Social Security benefit (PIA) from earnings, SSA's way: each year's earnings up to that year's
 * taxable maximum, indexed to the latest wage index; the highest 35 years averaged per month (AIME); then
 * 90% / 32% / 15% across the bend points. Everything is at today's wage level, so the PIA comes out in today's
 * dollars. Future earnings come from the plan in today's dollars. Not included: future real wage growth (makes
 * younger people's estimates a little conservative) and freezing the indexing at age 60.
 */
import {
  AWI,
  AWI_1977,
  BENDPOINTS_1977,
  CREDITS_NEEDED,
  CREDITS_PER_YEAR,
  EARNINGS_PER_CREDIT,
  EARNINGS_PER_CREDIT_BEFORE_1978,
  LATEST_AWI_YEAR,
  MAX_TAXABLE_EARNINGS,
} from "./ss-earnings-data"

const TOP_YEARS = 35
const MONTHS = 12
const RATES = [0.9, 0.32, 0.15] as const

/** One year of earnings: past years in that year's dollars, plan years in today's dollars. */
export interface EarningsYear {
  year: number
  amount: number
  /** Already in today's dollars (from the plan). */
  today?: boolean
}

export interface PiaEstimate {
  /** Monthly benefit at full retirement age, today's dollars. */
  pia: number
  /** Average indexed monthly earnings. */
  aime: number
  /** Years with earnings that count (of the top 35). */
  counted: number
  /** Work credits earned over the record (40 needed for a retirement benefit on your own record). */
  credits: number
  /** First year with 40 credits, or null if never reached in the record and plan. */
  eligibleYear: number | null
}

const latestMax = MAX_TAXABLE_EARNINGS[Math.max(...Object.keys(MAX_TAXABLE_EARNINGS).map(Number))]

/** A year's earnings at today's wage level, capped at that year's taxable maximum. */
export function indexedEarnings(e: EarningsYear, todayFromAwiLevel: number): number {
  if (e.today) return Math.min(e.amount, latestMax)
  const capped = Math.min(e.amount, MAX_TAXABLE_EARNINGS[e.year] ?? latestMax)
  const awi = AWI[Math.min(e.year, LATEST_AWI_YEAR)] ?? AWI[LATEST_AWI_YEAR]
  // Years after the latest published index are already near today's level.
  const level = e.year > LATEST_AWI_YEAR ? 1 : (AWI[LATEST_AWI_YEAR] / awi) * todayFromAwiLevel
  return capped * level
}

const latestPerCredit = EARNINGS_PER_CREDIT[Math.max(...Object.keys(EARNINGS_PER_CREDIT).map(Number))]

/** Credits for a year's earnings: one per that year's amount (today's for plan years), at most four. */
export function creditsFor(e: EarningsYear): number {
  const per = e.today ? latestPerCredit : e.year < 1978 ? EARNINGS_PER_CREDIT_BEFORE_1978 : (EARNINGS_PER_CREDIT[e.year] ?? latestPerCredit)
  return Math.min(CREDITS_PER_YEAR, Math.floor(Math.max(0, e.amount) / per))
}

/** Total credits, and the first year they reach 40 (earnings in year order). */
export function creditTally(earnings: EarningsYear[]): { credits: number; eligibleYear: number | null } {
  let credits = 0
  let eligibleYear: number | null = null
  for (const e of [...earnings].sort((a, b) => a.year - b.year)) {
    credits += creditsFor(e)
    if (eligibleYear === null && credits >= CREDITS_NEEDED) eligibleYear = e.year
  }
  return { credits, eligibleYear }
}

/** Today's bend points: SSA's 1977 values scaled by the latest wage index (the current year's published ones). */
export function bendPoints(todayFromAwiLevel: number): [number, number] {
  const scale = (AWI[LATEST_AWI_YEAR] / AWI_1977) * todayFromAwiLevel
  return [Math.round(BENDPOINTS_1977[0] * scale), Math.round(BENDPOINTS_1977[1] * scale)]
}

/** PIA from AIME across the bend points, rounded down to the dime as SSA does. */
export function piaFromAime(aime: number, [b1, b2]: [number, number]): number {
  const pia = RATES[0] * Math.min(aime, b1) + RATES[1] * Math.max(0, Math.min(aime, b2) - b1) + RATES[2] * Math.max(0, aime - b2)
  return Math.floor(pia * 10) / 10
}

/**
 * Estimate from an earnings record. `todayFromAwiLevel` brings the latest wage index (two years behind) up to
 * today's dollars; 1 matches SSA's published current-year bend points.
 */
export function estimatePia(earnings: EarningsYear[], todayFromAwiLevel = 1): PiaEstimate {
  const indexed = earnings.map((e) => indexedEarnings(e, todayFromAwiLevel)).filter((v) => v > 0).sort((a, b) => b - a)
  const top = indexed.slice(0, TOP_YEARS)
  const aime = Math.floor(top.reduce((s, v) => s + v, 0) / (TOP_YEARS * MONTHS))
  return { pia: piaFromAime(aime, bendPoints(todayFromAwiLevel)), aime, counted: top.length, ...creditTally(earnings) }
}

/** A rough record: working from `fromYear` to `toYear` at about `todaySalary` (today's dollars), wage-indexed back. */
export function roughHistory(fromYear: number, toYear: number, todaySalary: number): EarningsYear[] {
  const years = Array.from({ length: Math.max(0, toYear - fromYear + 1) }, (_, i) => fromYear + i)
  return years.map((year) => ({ year, amount: Math.round(todaySalary * ((AWI[Math.min(year, LATEST_AWI_YEAR)] ?? AWI[LATEST_AWI_YEAR]) / AWI[LATEST_AWI_YEAR])) }))
}

/** Earnings pasted from an SSA statement or spreadsheet: each line's first year (1950–2100) and the next amount. */
export function parseEarnings(text: string): EarningsYear[] {
  const byYear = new Map<number, number>()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\b(19[5-9]\d|20\d\d)\b[^\d$]*\$?\s*([\d,]+(?:\.\d+)?)/)
    if (!match) continue
    const year = Number(match[1])
    const amount = Number(match[2].replace(/,/g, ""))
    if (Number.isFinite(amount)) byYear.set(year, amount)
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, amount]) => ({ year, amount }))
}

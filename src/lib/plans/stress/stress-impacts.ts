/**
 * "What would help": the plan with one change at a time, each run through the same markets as the plan itself, so
 * a reader sees which levers move how often the money lasts. The changes are picked from what this plan holds.
 */

import type { AccountMix, PlanDocument } from "../plan-types"
import {
  futurePurchases,
  hasEverydaySpending,
  homesWithoutBackup,
  hasPaycheckToRetirement,
  portfolioMix,
  retireAt,
  retirementAge,
  scaleEverydaySpending,
  sellHomesIfNeeded,
  skipPurchase,
  withInvestmentMix,
} from "./stress-levers"
import { DEFAULT_STOCK_SHARE } from "./stress-mix"
import { isBroke, type CohortResult } from "./stress-test"

/** How much less everyday spending to try. */
const SPEND_CUT = 0.1
/** How many more working years to try. */
const MORE_YEARS = 3
/** Future purchases to try skipping, biggest first. */
const MAX_SKIPS = 2
/** A portfolio this far from 80/20 (in stocks, or any crypto or cash at all past this) gets an 80/20 row. */
const MIX_GAP = 0.1

export interface ImpactVariant {
  key: string
  label: string
  /** The change itself, applied to whatever the plan is when it runs (so Apply never writes back a stale copy). */
  apply: (doc: PlanDocument) => PlanDocument
  /** The change applied to the plan these numbers came from. */
  doc: PlanDocument
}

export interface ImpactResult {
  key: string
  label: string
  /** Cash lasts. */
  successRate: number
  /** Net worth lasts (never goes broke). */
  netWorthRate: number
  /** The typical age the cash ran out in the trials that ran out, or null when none did. */
  medianRunOutAge: number | null
}

const variant = (doc: PlanDocument, key: string, label: string, apply: ImpactVariant["apply"]): ImpactVariant => ({ key, label, apply, doc: apply(doc) })

const EIGHTY_TWENTY: AccountMix = { stocks: DEFAULT_STOCK_SHARE, bonds: 1 - DEFAULT_STOCK_SHARE, cash: 0, crypto: 0 }

/** A portfolio far from a plain 80/20 tries 80/20 everywhere. */
function investDifferently(doc: PlanDocument): ImpactVariant[] {
  const mix = portfolioMix(doc)
  if (!mix) return []
  const far = Math.abs(mix.stocks - EIGHTY_TWENTY.stocks) > MIX_GAP || mix.crypto > MIX_GAP / 2 || mix.cash > MIX_GAP
  return far ? [variant(doc, "mix-80", "Invest 80/20 stocks/bonds", (d) => withInvestmentMix(d, EIGHTY_TWENTY))] : []
}

function spendLess(doc: PlanDocument): ImpactVariant[] {
  if (!hasEverydaySpending(doc)) return []
  return [variant(doc, "spend-less", `Spend ${Math.round(SPEND_CUT * 100)}% less on everyday costs`, (d) => scaleEverydaySpending(d, 1 - SPEND_CUT))]
}

/** The biggest purchases still ahead (bought after the plan starts), each skipped on its own. */
function skipPurchases(doc: PlanDocument): ImpactVariant[] {
  return futurePurchases(doc)
    .slice(0, MAX_SKIPS)
    .map((a) => variant(doc, `skip-${a.id}`, `Skip buying ${a.name}`, (d) => skipPurchase(d, a.id)))
}

/** Homes the plan keeps with no backup plan: sell them if the money runs out (rent from then on). */
function sellIfNeeded(doc: PlanDocument): ImpactVariant[] {
  const homes = homesWithoutBackup(doc)
  if (homes.length === 0) return []
  return [variant(doc, "sell-homes", homes.length === 1 ? `Sell ${homes[0].name} if the portfolio is depleted` : "Sell your homes if the portfolio is depleted", sellHomesIfNeeded)]
}

/** Retire a few years later, when the plan has a paycheck that stops at retirement. */
function workLonger(doc: PlanDocument): ImpactVariant[] {
  const age = retirementAge(doc)
  if (age === null || !hasPaycheckToRetirement(doc)) return []
  return [variant(doc, "work-longer", `Retire ${MORE_YEARS} years later`, (d) => retireAt(d, age + MORE_YEARS))]
}

/** The changes worth trying for this plan, each one alone. */
export function impactVariants(doc: PlanDocument): ImpactVariant[] {
  return [...investDifferently(doc), ...spendLess(doc), ...skipPurchases(doc), ...sellIfNeeded(doc), ...workLonger(doc)]
}

/** One variant's trials boiled down: how often the money lasted and when it typically ran out. */
export function impactOf(key: string, label: string, cohorts: CohortResult[]): ImpactResult {
  const ages = cohorts.flatMap((c) => (c.depletedAge !== null ? [c.depletedAge] : [])).sort((a, b) => a - b)
  const successRate = cohorts.length > 0 ? 1 - ages.length / cohorts.length : 0
  const netWorthRate = cohorts.length > 0 ? 1 - cohorts.filter(isBroke).length / cohorts.length : 0
  return { key, label, successRate, netWorthRate, medianRunOutAge: ages.length > 0 ? ages[Math.floor((ages.length - 1) / 2)] : null }
}

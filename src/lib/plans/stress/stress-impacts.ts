/**
 * "What would help": the plan with one change at a time, each run through the same markets as the plan itself, so
 * a reader sees which levers move how often the money lasts. The changes are picked from what this plan holds.
 */

import { fallbackHomes, plannedSaleIndex } from "../plan-home-fallback"
import { resolveTiming, timingContext } from "../plan-timing"
import type { AccountMix, PlanDocument } from "../plan-types"
import {
  hasEverydaySpending,
  hasPaycheckToRetirement,
  portfolioMix,
  retireAt,
  retirementAge,
  scaleEverydaySpending,
  withInvestmentMix,
} from "./stress-levers"
import { DEFAULT_STOCK_SHARE } from "./stress-mix"
import type { CohortResult } from "./stress-test"

/** How much less everyday spending to try. */
const SPEND_CUT = 0.1
/** How many more working years to try. */
const MORE_YEARS = 3
/** Future purchases to try skipping, biggest first. */
const MAX_SKIPS = 2
/** Rent at about 0.4% of the home's value a month, as the stress test setup guesses. */
const RENT_PER_VALUE = 0.004
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
  successRate: number
  /** The typical age the money ran out in the trials that ran out, or null when none did. */
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
  const ctx = timingContext(doc)
  return doc.assets
    .filter((a) => a.acquired !== "received" && !a.origin && !a.replacementOf && (resolveTiming(a.start, ctx) ?? 0) > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_SKIPS)
    .map((a) => variant(doc, `skip-${a.id}`, `Skip buying ${a.name}`, (d) => ({ ...d, assets: d.assets.filter((x) => x.id !== a.id) })))
}

/** Homes the plan keeps with no backup plan: sell one if the money runs out (rent from then on). */
function sellIfNeeded(doc: PlanDocument): ImpactVariant[] {
  const homes = fallbackHomes(doc).filter((h) => !h.fallback && plannedSaleIndex(doc, h) === null)
  if (homes.length === 0) return []
  const ids = new Set(homes.map((h) => h.id))
  const apply = (d: PlanDocument): PlanDocument => ({
    ...d,
    assets: d.assets.map((a) => (ids.has(a.id) && !a.fallback ? { ...a, fallback: { then: "rent" as const, monthlyRent: Math.round(a.value * RENT_PER_VALUE), price: 0 } } : a)),
  })
  return [variant(doc, "sell-homes", homes.length === 1 ? `Sell ${homes[0].name} if the money runs out` : "Sell your homes if the money runs out", apply)]
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
  return { key, label, successRate, medianRunOutAge: ages.length > 0 ? ages[Math.floor((ages.length - 1) / 2)] : null }
}

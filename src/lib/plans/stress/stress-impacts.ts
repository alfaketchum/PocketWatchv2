/**
 * "What would help": the plan with one change at a time, each run through the same markets as the plan itself, so
 * a reader sees which levers move how often the money lasts. The changes are picked from what this plan holds.
 */

import { RETIREMENT_MILESTONE_ID } from "../plan-constants"
import { fallbackHomes, plannedSaleIndex } from "../plan-home-fallback"
import { resolveTiming, timingContext } from "../plan-timing"
import type { AccountMix, PlanDocument, PlanMilestone, Timing } from "../plan-types"
import { DEFAULT_STOCK_SHARE, mixFor } from "./stress-mix"
import type { CohortResult } from "./stress-test"

/** Crypto at or above this share of the accounts gets its own what-ifs. */
const CRYPTO_SHARE = 0.2
/** How much less everyday spending to try. */
const SPEND_CUT = 0.1
/** How many more working years to try. */
const MORE_YEARS = 3
/** Future purchases to try skipping, biggest first. */
const MAX_SKIPS = 2
/** Rent at about 0.4% of the home's value a month, as the stress test setup guesses. */
const RENT_PER_VALUE = 0.004

export interface ImpactVariant {
  key: string
  label: string
  doc: PlanDocument
}

export interface ImpactResult {
  key: string
  label: string
  successRate: number
  /** The typical age the money ran out in the trials that ran out, or null when none did. */
  medianRunOutAge: number | null
}

const STOCKS_BONDS: AccountMix = { stocks: DEFAULT_STOCK_SHARE, bonds: 1 - DEFAULT_STOCK_SHARE, cash: 0, crypto: 0 }

/** Each account's crypto cut to `keep` of itself, the rest in 80/20 stocks and bonds. */
function withCrypto(doc: PlanDocument, keep: number): PlanDocument {
  const accounts = doc.accounts.map((a) => {
    const mix = mixFor(a)
    if (mix.crypto <= 0) return a
    const moved = mix.crypto * (1 - keep)
    return { ...a, mix: { stocks: mix.stocks + moved * STOCKS_BONDS.stocks, bonds: mix.bonds + moved * STOCKS_BONDS.bonds, cash: mix.cash, crypto: mix.crypto * keep } }
  })
  return { ...doc, accounts }
}

function cryptoVariants(doc: PlanDocument): ImpactVariant[] {
  const total = doc.accounts.reduce((s, a) => s + Math.max(0, a.balance), 0)
  const crypto = doc.accounts.reduce((s, a) => s + Math.max(0, a.balance) * mixFor(a).crypto, 0)
  if (total <= 0 || crypto / total < CRYPTO_SHARE) return []
  return [
    { key: "crypto-half", label: "Half your crypto in stocks & bonds", doc: withCrypto(doc, 0.5) },
    { key: "crypto-none", label: "All your crypto in stocks & bonds", doc: withCrypto(doc, 0) },
  ]
}

function spendLess(doc: PlanDocument): ImpactVariant[] {
  if (!doc.expenses.some((e) => !e.oneTime && !e.origin)) return []
  const expenses = doc.expenses.map((e) => (e.oneTime || e.origin ? e : { ...e, amount: e.amount * (1 - SPEND_CUT) }))
  return [{ key: "spend-less", label: `Spend ${Math.round(SPEND_CUT * 100)}% less on everyday costs`, doc: { ...doc, expenses } }]
}

/** The biggest purchases still ahead (bought after the plan starts), each skipped on its own. */
function skipPurchases(doc: PlanDocument): ImpactVariant[] {
  const ctx = timingContext(doc)
  return doc.assets
    .filter((a) => a.acquired !== "received" && !a.origin && !a.replacementOf && (resolveTiming(a.start, ctx) ?? 0) > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_SKIPS)
    .map((a) => ({ key: `skip-${a.id}`, label: `Skip buying ${a.name}`, doc: { ...doc, assets: doc.assets.filter((x) => x.id !== a.id) } }))
}

/** Homes the plan keeps with no backup plan: sell one if the money runs out (rent from then on). */
function sellIfNeeded(doc: PlanDocument): ImpactVariant[] {
  const homes = fallbackHomes(doc).filter((h) => !h.fallback && plannedSaleIndex(doc, h) === null)
  if (homes.length === 0) return []
  const assets = doc.assets.map((a) =>
    homes.some((h) => h.id === a.id) ? { ...a, fallback: { then: "rent" as const, monthlyRent: Math.round(a.value * RENT_PER_VALUE), price: 0 } } : a,
  )
  return [{ key: "sell-homes", label: homes.length === 1 ? `Sell ${homes[0].name} if the money runs out` : "Sell your homes if the money runs out", doc: { ...doc, assets } }]
}

const later = (t: Timing): Timing | null => (t.type === "age" ? { ...t, age: t.age + MORE_YEARS } : t.type === "year" ? { ...t, year: t.year + MORE_YEARS } : null)

/** Retire a few years later, when the plan has a paycheck that stops at retirement. */
function workLonger(doc: PlanDocument): ImpactVariant[] {
  const paid = doc.incomes.some((i) => (i.kind === "salary" || i.kind === "business") && i.amount > 0)
  const retirement = doc.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID)
  const timing = retirement ? later(retirement.timing) : null
  if (!paid || !retirement || !timing) return []
  const milestones = doc.milestones.map((m): PlanMilestone => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing } : m))
  return [{ key: "work-longer", label: `Retire ${MORE_YEARS} years later`, doc: { ...doc, milestones } }]
}

/** The changes worth trying for this plan, each one alone. */
export function impactVariants(doc: PlanDocument): ImpactVariant[] {
  return [...cryptoVariants(doc), ...spendLess(doc), ...skipPurchases(doc), ...sellIfNeeded(doc), ...workLonger(doc)]
}

/** One variant's trials boiled down: how often the money lasted and when it typically ran out. */
export function impactOf(key: string, label: string, cohorts: CohortResult[]): ImpactResult {
  const ages = cohorts.flatMap((c) => (c.depletedAge !== null ? [c.depletedAge] : [])).sort((a, b) => a - b)
  const successRate = cohorts.length > 0 ? 1 - ages.length / cohorts.length : 0
  return { key, label, successRate, medianRunOutAge: ages.length > 0 ? ages[Math.floor((ages.length - 1) / 2)] : null }
}

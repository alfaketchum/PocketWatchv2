/**
 * The levers "What would help" and the solvers pull: pure changes to a plan, each a single knob, shared so a row's
 * Apply button makes exactly the change its numbers came from.
 */

import { RETIREMENT_MILESTONE_ID } from "../plan-constants"
import { livesIn } from "../plan-asset-costs"
import { fallbackHomes, plannedSaleIndex } from "../plan-home-fallback"
import { ageAtStart, resolveRange, resolveTiming, timingContext } from "../plan-timing"
import type { AccountMix, PlanAccount, PlanDocument, PlanIncome } from "../plan-types"
import { claimFactor, SS_EARLIEST_AGE, SS_LATEST_AGE, yearlyBenefit } from "../social-security"
import { mixFor } from "./stress-mix"

/** Everyday costs: recurring expenses you entered (not one-time, not added by a milestone or template). */
const isEveryday = (e: PlanDocument["expenses"][number]) => !e.oneTime && !e.origin

export const hasEverydaySpending = (doc: PlanDocument) => doc.expenses.some(isEveryday)

/**
 * A year of everyday costs today: the lines running in the plan's first year (lines that come later, like a
 * bigger rent or a degree, don't add to it). Every line when none runs yet.
 */
export function everydaySpending(doc: PlanDocument): number {
  const ctx = timingContext(doc)
  const lines = doc.expenses.filter(isEveryday)
  const now = lines.filter((e) => {
    const { start, end } = resolveRange(e.start, e.end, ctx)
    return Math.max(0, start) <= 0 && 0 < end
  })
  return (now.length > 0 ? now : lines).reduce((s, e) => s + e.amount, 0)
}

/** Every everyday cost scaled by `factor` (kids' costs, home and car costs and one-time items stay as they are). */
export function scaleEverydaySpending(doc: PlanDocument, factor: number): PlanDocument {
  return { ...doc, expenses: doc.expenses.map((e) => (isEveryday(e) ? { ...e, amount: Math.round(e.amount * factor) } : e)) }
}

/** Accounts whose holdings are an investment choice: not cash, not a 529. */
export const isInvested = (a: PlanAccount) => a.taxTreatment !== "cash" && a.taxTreatment !== "education"

/** The whole portfolio's mix, weighted by balance (null without invested money). */
export function portfolioMix(doc: PlanDocument): AccountMix | null {
  const invested = doc.accounts.filter((a) => isInvested(a) && a.balance > 0)
  const total = invested.reduce((s, a) => s + a.balance, 0)
  if (total <= 0) return null
  const sum = (k: keyof AccountMix) => invested.reduce((s, a) => s + a.balance * mixFor(a)[k], 0) / total
  return { stocks: sum("stocks"), bonds: sum("bonds"), cash: sum("cash"), crypto: sum("crypto") }
}

/** Every invested account holding `mix` (cash accounts and 529s are left alone; assumed returns don't change). */
export function withInvestmentMix(doc: PlanDocument, mix: AccountMix): PlanDocument {
  return { ...doc, accounts: doc.accounts.map((a) => (isInvested(a) ? { ...a, mix } : a)) }
}

export interface MixRung {
  key: string
  label: string
  mix: AccountMix
}

const stocksBonds = (stocks: number): AccountMix => ({ stocks, bonds: 1 - stocks, cash: 0, crypto: 0 })
const near = (a: AccountMix, b: AccountMix) => (["stocks", "bonds", "cash", "crypto"] as const).every((k) => Math.abs(a[k] - b[k]) < 0.02)
const pct = (v: number) => `${Math.round(v * 100)}`

/** Below this much crypto, halving it isn't worth its own rung. */
const CRYPTO_RUNG = 0.05

/**
 * The mixes worth trying, from today's toward safer: crypto halved (the rest moved to 80/20 stocks and bonds), then
 * all stocks, 80/20, 60/40 and 40/60. Rungs that match today's mix are left out.
 */
export function investmentLadder(doc: PlanDocument): MixRung[] {
  const now = portfolioMix(doc)
  if (!now) return []
  const rungs: MixRung[] = []
  if (now.crypto >= CRYPTO_RUNG) {
    const moved = now.crypto / 2
    rungs.push({ key: "crypto-half", label: "Half your crypto in stocks & bonds", mix: { stocks: now.stocks + moved * 0.8, bonds: now.bonds + moved * 0.2, cash: now.cash, crypto: now.crypto - moved } })
  }
  for (const stocks of [1, 0.8, 0.6, 0.4]) {
    const mix = stocksBonds(stocks)
    rungs.push({ key: `mix-${pct(stocks)}`, label: stocks === 1 ? "All stocks" : `${pct(stocks)}/${pct(1 - stocks)} stocks/bonds`, mix })
  }
  return rungs.filter((r) => !near(r.mix, now))
}

/** The plan's retirement age, or null without a retirement milestone and a person. */
export function retirementAge(doc: PlanDocument): number | null {
  const person = doc.people[0]
  const retirement = doc.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID)
  const index = retirement && person ? resolveTiming(retirement.timing, timingContext(doc)) : null
  return index === null || !person ? null : ageAtStart(person, doc.settings) + index
}

/** Whether the plan has a paycheck that stops at retirement (so retiring later earns more). */
export function hasPaycheckToRetirement(doc: PlanDocument): boolean {
  return doc.incomes.some(
    (i) => (i.kind === "salary" || i.kind === "business") && i.amount > 0 && i.end.type === "milestone" && i.end.milestoneId === RETIREMENT_MILESTONE_ID,
  )
}

/** Retirement at `age` (everything tied to the retirement milestone moves with it). */
export function retireAt(doc: PlanDocument, age: number): PlanDocument {
  const person = doc.people[0]
  if (!person) return doc
  const timing = { type: "age" as const, personId: person.id, age }
  return { ...doc, milestones: doc.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing } : m)) }
}

/** The first person's Social Security income (null without one, or without an age it starts at). */
export function socialSecurityOf(doc: PlanDocument): { income: PlanIncome; claimAge: number } | null {
  const person = doc.people[0]
  const income = doc.incomes.find((i) => i.kind === "social_security" && (!i.personId || i.personId === person?.id))
  if (!income || !person) return null
  if (income.socialSecurity) return { income, claimAge: income.socialSecurity.claimAge }
  return income.start.type === "age" ? { income, claimAge: income.start.age } : null
}

/**
 * Social Security claimed at `age`: it starts then, and the benefit follows the claim age (from the estimate's
 * full-retirement-age amount, or scaled by the claim factors for an amount entered by hand).
 */
export function claimSocialSecurityAt(doc: PlanDocument, age: number): PlanDocument {
  const person = doc.people[0]
  const ss = socialSecurityOf(doc)
  if (!person || !ss) return doc
  const claim = Math.min(SS_LATEST_AGE, Math.max(SS_EARLIEST_AGE, age))
  const details = ss.income.socialSecurity
  const amount = details
    ? Math.round(yearlyBenefit(details.pia, person.birthYear, claim))
    : Math.round((ss.income.amount * claimFactor(person.birthYear, claim)) / claimFactor(person.birthYear, ss.claimAge))
  const next: PlanIncome = {
    ...ss.income,
    amount,
    start: { type: "age", personId: person.id, age: claim },
    ...(details ? { socialSecurity: { ...details, claimAge: claim } } : {}),
  }
  return { ...doc, incomes: doc.incomes.map((i) => (i.id === ss.income.id ? next : i)) }
}

/** Rent at about 0.4% of the home's value a month, as the stress test setup guesses. */
const RENT_PER_VALUE = 0.004

/** Homes the plan keeps with no backup plan (the ones "sell if the money runs out" would change). */
export const homesWithoutBackup = (doc: PlanDocument) => fallbackHomes(doc).filter((h) => !h.fallback && plannedSaleIndex(doc, h) === null)

/** Every kept home with no backup plan sells if the money runs out: you rent after selling the one you live in; a
 *  second home or a rental is just sold. */
export function sellHomesIfNeeded(doc: PlanDocument): PlanDocument {
  const ids = new Set(homesWithoutBackup(doc).map((h) => h.id))
  if (ids.size === 0) return doc
  return {
    ...doc,
    assets: doc.assets.map((a) =>
      ids.has(a.id) ? { ...a, fallback: { then: livesIn(a) ? ("rent" as const) : ("sell" as const), monthlyRent: livesIn(a) ? Math.round(a.value * RENT_PER_VALUE) : 0, price: 0 } } : a,
    ),
  }
}

/** Purchases still ahead (bought after the plan starts, by you), biggest first. */
export function futurePurchases(doc: PlanDocument) {
  const ctx = timingContext(doc)
  return doc.assets
    .filter((a) => a.acquired !== "received" && !a.origin && !a.replacementOf && (resolveTiming(a.start, ctx) ?? 0) > 0)
    .sort((a, b) => b.value - a.value)
}

export const skipPurchase = (doc: PlanDocument, assetId: string): PlanDocument => ({ ...doc, assets: doc.assets.filter((a) => a.id !== assetId) })

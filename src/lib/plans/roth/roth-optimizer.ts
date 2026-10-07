/**
 * Roth conversion optimizer: simulates the plan with each candidate strategy and ranks them by after-tax ending net
 * worth (traditional balances left are taxed at the heirs' rate), against no conversions. Strategies that make the
 * money run out sooner are dropped. The best few are then refined with nearby variations.
 */
import { simulatePlan } from "../engine/simulate"
import { summarizePlan } from "../plan-summary"
import type { PlanDocument } from "../plan-types"
import { nearby, rothStrategies, strategyCandidate, type RothCandidate, type RothStrategy } from "./roth-candidates"

/** Results kept, and how many of the best are refined. */
const TOP = 10
const REFINE = 3

export interface RothOutcome {
  afterTaxNetWorth: number
  endingNetWorth: number
  lifetimeTaxes: number
  lifetimeRequired: number
  lifetimeConversions: number
  /** Age the accounts run dry; null when they don't. */
  depletedAge: number | null
}

export interface RothResult {
  candidate: RothCandidate
  outcome: RothOutcome
  /** After-tax net worth gained over no conversions (today's dollars). */
  gain: number
}

export interface RothOptimization {
  baseline: RothOutcome
  /** The plan's own rules, when it has any. */
  current: RothOutcome | null
  top: RothResult[]
  /** Simulations run. */
  runs: number
}

export function evaluate(doc: PlanDocument): RothOutcome {
  const s = summarizePlan(doc, simulatePlan(doc))
  return {
    afterTaxNetWorth: s.afterTaxEndingNetWorth,
    endingNetWorth: s.endingNetWorth,
    lifetimeTaxes: s.lifetimeTaxes,
    lifetimeRequired: s.lifetimeRequired,
    lifetimeConversions: s.lifetimeConversions,
    depletedAge: s.depletedAge,
  }
}

/** The plan with the candidate's rules in place of its own (and any Roth accounts it opens). */
export function applyCandidate(doc: PlanDocument, c: RothCandidate): PlanDocument {
  const have = new Set(doc.accounts.map((a) => a.id))
  return { ...doc, accounts: [...doc.accounts, ...c.newAccounts.filter((a) => !have.has(a.id))], conversions: c.rules }
}

/** Runs out at least as late as the baseline (or not at all). */
function keepsUp(outcome: RothOutcome, baseline: RothOutcome): boolean {
  return outcome.depletedAge === null || (baseline.depletedAge !== null && outcome.depletedAge >= baseline.depletedAge)
}

/** Different windows often convert the same money (the accounts run dry first): keep the first of each outcome. */
function distinct<T extends { result: RothResult }>(sorted: T[]): T[] {
  const seen = new Set<string>()
  return sorted.filter(({ result: { outcome: o } }) => {
    const key = `${Math.round(o.afterTaxNetWorth)}|${Math.round(o.lifetimeConversions)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Every strategy, then nearby variations of the best few; `onStep(done, total)` after each simulation. */
export function optimizeRoth(doc: PlanDocument, onStep: (done: number, total: number) => void = () => {}): RothOptimization {
  const baseline = evaluate({ ...doc, conversions: [] })
  const current = (doc.conversions ?? []).length > 0 ? evaluate(doc) : null
  const tried = new Map<string, { strategy: RothStrategy; result: RothResult }>()
  const strategies = rothStrategies(doc)
  let total = strategies.length + REFINE * 6
  let done = 0
  const run = (strategy: RothStrategy) => {
    const candidate = strategyCandidate(doc, strategy)
    done += 1
    onStep(done, total)
    if (!candidate || tried.has(candidate.id)) return
    const outcome = evaluate(applyCandidate(doc, candidate))
    if (!keepsUp(outcome, baseline)) return
    tried.set(candidate.id, { strategy, result: { candidate, outcome, gain: outcome.afterTaxNetWorth - baseline.afterTaxNetWorth } })
  }
  strategies.forEach(run)
  const ranked = () => distinct([...tried.values()].sort((a, b) => b.result.gain - a.result.gain))
  const refine = ranked().slice(0, REFINE).flatMap((t) => nearby(t.strategy))
  total = strategies.length + refine.length
  refine.forEach(run)
  return { baseline, current, top: ranked().slice(0, TOP).map((t) => t.result), runs: done }
}

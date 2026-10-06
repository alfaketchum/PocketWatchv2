/**
 * Solvers: how far one lever has to move for the plan to last in a target share of trials. Every candidate runs on
 * the same market paths (so answers are stable and comparisons fair), and a candidate stops as soon as it has clearly
 * met or missed the target. Pure and synchronous: it runs in a Web Worker on the page, and directly in tests.
 */

import type { AccountMix, PlanDocument } from "../plan-types"
import { ageAtStart } from "../plan-timing"
import { SS_EARLIEST_AGE, SS_LATEST_AGE } from "../social-security"
import type { AnnualHistory } from "./stress-history"
import {
  claimSocialSecurityAt,
  everydaySpending,
  hasEverydaySpending,
  hasPaycheckToRetirement,
  investmentLadder,
  retireAt,
  retirementAge,
  scaleEverydaySpending,
  socialSecurityOf,
  withInvestmentMix,
} from "./stress-levers"
import type { SamplingOptions } from "./stress-sampling"
import { runPath, stressPaths, type StressInflation } from "./stress-test"

export type SolverKey = "spending" | "mix" | "retirement" | "socialSecurity"
export const SOLVER_KEYS: SolverKey[] = ["spending", "mix", "retirement", "socialSecurity"]

/** A change a solver found, as plain data (it crosses from the worker to the page, where Apply makes it). */
export type SolverChange =
  | { kind: "spending"; factor: number }
  | { kind: "mix"; mix: AccountMix; label: string }
  | { kind: "retirement"; age: number }
  | { kind: "socialSecurity"; age: number }

export interface SolverResult {
  key: SolverKey
  /** found: this change reaches the target; alreadyMet: the plan reaches it, and this is how far it could go;
   *  unreachable: even the furthest change tried falls short (the change is that furthest one). */
  status: "found" | "alreadyMet" | "unreachable"
  change: SolverChange
  /** The plan's value today and the solved one: everyday spending in today's dollars, an age, or a mix's label. */
  now: number | string
  value: number | string
  successRate: number
  baselineRate: number
}

export interface SolveRequest {
  key: SolverKey
  doc: PlanDocument
  annual: AnnualHistory
  anchor: number
  inflation: StressInflation
  sampling: SamplingOptions
  target: number
}

/** Spending factors searched, and how close the answer gets. */
const SPEND_MIN = 0.3
const SPEND_MAX = 2
const SPEND_STEP = 0.01
/** Latest retirement age tried. */
const MAX_RETIRE_AGE = 80

export function applyChange(doc: PlanDocument, change: SolverChange): PlanDocument {
  switch (change.kind) {
    case "spending":
      return scaleEverydaySpending(doc, change.factor)
    case "mix":
      return withInvestmentMix(doc, change.mix)
    case "retirement":
      return retireAt(doc, change.age)
    case "socialSecurity":
      return claimSocialSecurityAt(doc, change.age)
  }
}

/** Whether a solver has anything to move in this plan. */
export function solverApplies(doc: PlanDocument, key: SolverKey): boolean {
  if (key === "spending") return hasEverydaySpending(doc)
  if (key === "mix") return investmentLadder(doc).length > 0
  if (key === "retirement") return retirementAge(doc) !== null && hasPaycheckToRetirement(doc)
  return socialSecurityOf(doc) !== null
}

type Evaluate = (doc: PlanDocument, early?: boolean) => { rate: number; meets: boolean }

/**
 * Runs a plan on the request's paths. With `early`, stops once the target is decided either way (the rate is then
 * only a bound); without, runs every path for the exact rate.
 */
function evaluator(req: SolveRequest, onStep: () => void): Evaluate {
  const paths = stressPaths(req.doc, req.annual, req.anchor, req.sampling)
  const total = paths.length
  const need = Math.ceil(req.target * total - 1e-9)
  return (doc, early = false) => {
    let ok = 0
    let failed = 0
    for (let i = 0; i < total; i++) {
      const c = runPath(doc, req.annual, paths[i], req.anchor, req.inflation, i)
      if (c.depletedAge === null) ok++
      else failed++
      if (early && (ok >= need || failed > total - need)) break
    }
    onStep()
    return { rate: total > 0 ? ok / total : 0, meets: ok >= need }
  }
}

/** The largest (or smallest) value in [lo, hi] at `step` that meets the target, given the target is monotone in it. */
function bisect(lo: number, hi: number, step: number, meets: (v: number) => boolean, want: "max" | "min"): number {
  let [a, b] = [lo, hi]
  while (b - a > step + 1e-9) {
    const mid = Math.round((a + b) / 2 / step) * step
    if (mid <= a || mid >= b) break
    if (meets(mid) === (want === "max")) a = mid
    else b = mid
  }
  return want === "max" ? a : b
}

function solveSpending(req: SolveRequest, run: Evaluate, baselineRate: number): SolverResult {
  const now = everydaySpending(req.doc)
  const meets = (f: number) => run(scaleEverydaySpending(req.doc, f), true).meets
  const result = (status: SolverResult["status"], factor: number): SolverResult => ({
    key: "spending",
    status,
    change: { kind: "spending", factor },
    now,
    value: Math.round((now * factor) / 1_000) * 1_000,
    successRate: run(scaleEverydaySpending(req.doc, factor)).rate,
    baselineRate,
  })
  if (baselineRate >= req.target) return result("alreadyMet", meets(SPEND_MAX) ? SPEND_MAX : bisect(1, SPEND_MAX, SPEND_STEP, meets, "max"))
  if (!meets(SPEND_MIN)) return result("unreachable", SPEND_MIN)
  return result("found", bisect(SPEND_MIN, 1, SPEND_STEP, meets, "max"))
}

function solveRetirement(req: SolveRequest, run: Evaluate, baselineRate: number): SolverResult {
  const now = retirementAge(req.doc)!
  const person = req.doc.people[0]
  const earliest = ageAtStart(person, req.doc.settings) + 1
  const meets = (age: number) => run(retireAt(req.doc, age), true).meets
  const result = (status: SolverResult["status"], age: number): SolverResult => ({
    key: "retirement",
    status,
    change: { kind: "retirement", age },
    now,
    value: age,
    successRate: run(retireAt(req.doc, age)).rate,
    baselineRate,
  })
  if (baselineRate >= req.target) {
    if (now <= earliest || meets(earliest)) return result("alreadyMet", Math.min(now, earliest))
    return result("alreadyMet", bisect(earliest, now, 1, meets, "min"))
  }
  if (now >= MAX_RETIRE_AGE || !meets(MAX_RETIRE_AGE)) return result("unreachable", Math.max(now, MAX_RETIRE_AGE))
  return result("found", bisect(now, MAX_RETIRE_AGE, 1, meets, "min"))
}

/** Every rung of the investment ladder, exact; the least change that meets the target, or the best one. */
function solveMix(req: SolveRequest, run: Evaluate, baselineRate: number): SolverResult {
  const rungs = investmentLadder(req.doc).map((r) => ({ ...r, rate: run(withInvestmentMix(req.doc, r.mix)).rate }))
  const enough = rungs.find((r) => r.rate >= req.target)
  const best = rungs.reduce((m, r) => (r.rate > m.rate ? r : m), rungs[0])
  const pick = enough ?? best
  const status = baselineRate >= req.target ? "alreadyMet" : enough ? "found" : "unreachable"
  return { key: "mix", status, change: { kind: "mix", mix: pick.mix, label: pick.label }, now: "Today's mix", value: pick.label, successRate: pick.rate, baselineRate }
}

/** Every claim age from 62 to 70, exact; the best one (the earlier on a tie). */
function solveSocialSecurity(req: SolveRequest, run: Evaluate, baselineRate: number): SolverResult {
  const now = socialSecurityOf(req.doc)!.claimAge
  let best = { age: now, rate: baselineRate }
  for (let age = SS_EARLIEST_AGE; age <= SS_LATEST_AGE; age++) {
    const rate = age === now ? baselineRate : run(claimSocialSecurityAt(req.doc, age)).rate
    if (rate > best.rate + 1e-9) best = { age, rate }
  }
  const status = baselineRate >= req.target ? "alreadyMet" : best.rate >= req.target ? "found" : "unreachable"
  return { key: "socialSecurity", status, change: { kind: "socialSecurity", age: best.age }, now, value: best.age, successRate: best.rate, baselineRate }
}

/** Runs one solver; `onStep` fires after every candidate (for a progress count). Null when it doesn't apply. */
export function solve(req: SolveRequest, onStep: () => void = () => {}): SolverResult | null {
  if (!solverApplies(req.doc, req.key)) return null
  const run = evaluator(req, onStep)
  const baselineRate = run(req.doc).rate
  if (req.key === "spending") return solveSpending(req, run, baselineRate)
  if (req.key === "retirement") return solveRetirement(req, run, baselineRate)
  if (req.key === "mix") return solveMix(req, run, baselineRate)
  return solveSocialSecurity(req, run, baselineRate)
}

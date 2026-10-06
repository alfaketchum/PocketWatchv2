import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import type { PlanAccount, PlanDocument } from "@/lib/plans/plan-types"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { DEFAULT_SAMPLING, seededRandom, trialPaths, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import { endingComposition, histogram, inSlice } from "@/lib/plans/stress/stress-histogram"
import { cohortStarts, runCohort, runPath, stressPaths, summarize, type CohortResult } from "@/lib/plans/stress/stress-test"

const NOW = new Date(2026, 0, 15)

function account(id: string): PlanAccount {
  return { id, name: id, taxTreatment: "taxable", balance: 100_000, costBasis: null, returnRate: 0.05, owner: null, source: null, mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 } }
}

/** A 10-year plan (age 35–44) spending `spend` a year from one stock account, no taxes or inflation. */
function plan(spend: number): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [account("a")],
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: null, amount: spend, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  }
}

function history(stocks: number[]): AnnualHistory {
  return {
    years: stocks.map((_, i) => 1900 + i),
    stocks,
    bonds: stocks.map(() => 0),
    cape: stocks.map((_, i) => 10 + i),
    inflation: stocks.map(() => null),
    stockLogMean: Math.log(1.05),
    latestCape: 30,
  }
}

const opts = (extra: Partial<SamplingOptions>): SamplingOptions => ({ ...DEFAULT_SAMPLING, trials: 200, ...extra })

test("seededRandom repeats for a seed and differs across seeds", () => {
  const a = seededRandom(7)
  const b = seededRandom(7)
  const c = seededRandom(8)
  const xs = Array.from({ length: 5 }, () => a())
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b()))
  assert.notDeepEqual(xs, Array.from({ length: 5 }, () => c()))
  assert.ok(xs.every((x) => x >= 0 && x < 1))
})

test("every method: the same seed gives the same trials; paths have the plan's length and stay inside history", () => {
  for (const method of ["restart", "block", "random"] as const) {
    const one = trialPaths(30, 12, opts({ method }))
    assert.deepEqual(one, trialPaths(30, 12, opts({ method })), method)
    assert.notDeepEqual(one, trialPaths(30, 12, opts({ method, seed: 2 })), method)
    assert.equal(one.length, 200)
    for (const path of one) {
      assert.equal(path.length, 12)
      assert.ok(path.every((h) => Number.isInteger(h) && h >= 0 && h < 30), method)
    }
  }
})

test("block bootstrap: consecutive years within each block", () => {
  for (const path of trialPaths(40, 23, opts({ method: "block", blockLength: 5 }))) {
    for (let b = 0; b < path.length; b += 5) {
      const block = path.slice(b, b + 5)
      block.forEach((h, i) => assert.equal(h, block[0] + i))
    }
  }
})

test("random restart: trial i starts at year i and runs in order until history ends", () => {
  const paths = trialPaths(10, 6, opts({ method: "restart", trials: 10 }))
  paths.forEach((path, i) => {
    assert.equal(path[0], i)
    const inOrder = Math.min(6, 10 - i)
    for (let t = 1; t < inOrder; t++) assert.equal(path[t], path[t - 1] + 1)
  })
})

test("history paths are exactly the complete cohorts, and running them matches runCohort", () => {
  const doc = plan(9_000)
  const h = history([-0.5, 0.1, 0.2, 0, -0.1, 0.3, 0.05, 0, 0, 0.1, 0.02, -0.2, 0.15])
  const paths = stressPaths(doc, h, 0, opts({ method: "history" }))
  const starts = cohortStarts(doc, h, 0)
  assert.deepEqual(paths.map((p) => p[0]), starts)
  assert.deepEqual(trialPaths(h.years.length, 10, opts({ method: "history" })), paths)
  paths.forEach((path, i) => assert.deepEqual(runPath(doc, h, path, 0, "plan"), runCohort(doc, h, starts[i], 0, "plan")))
})

test("retirement-anchored history paths keep assumed returns before the record", () => {
  const base = plan(1_000)
  const doc: PlanDocument = {
    ...base,
    milestones: base.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: { type: "age", personId: base.people[0].id, age: 40 } } : m)),
  }
  const h = history(Array(12).fill(0.05))
  const [first] = stressPaths(doc, h, 5, opts({ method: "history" }))
  assert.deepEqual(first.slice(0, 6), [-5, -4, -3, -2, -1, 0])
  const r = runCohort(doc, h, 0, 5)
  assert.equal(r.year, 1900)
  assert.deepEqual(r.sequence.slice(0, 6), [null, null, null, null, null, 1900])
})

test("simulated trials run through the engine: labelled, with withdrawal rates and a filterable summary", () => {
  const doc = plan(9_000)
  const h = history([-0.5, 0.1, 0.2, 0, -0.1, 0.3, 0.05, 0, 0, 0.1, 0.02, -0.2, 0.15])
  const paths = stressPaths(doc, h, 0, opts({ method: "block", trials: 50, blockLength: 3 }))
  assert.equal(paths.length, 50)
  const trials = paths.map((p, i) => runPath(doc, h, p, 0, "plan", i))
  assert.equal(trials[3].trial, 3)
  assert.equal(trials[3].year, 1900 + paths[3][0])
  assert.deepEqual(trials[3].sequence, paths[3].map((x) => 1900 + x))
  // 9k from 100k in year one: 9% of the starting balance.
  assert.ok(Math.abs(trials[0].withdrawalRate[0] - 0.09) < 1e-9)
  const all = summarize(trials, null)
  const failed = summarize(trials, null, (c) => c.depletedAge !== null)
  assert.equal(failed.successRate, 0)
  assert.equal(failed.cohorts.length, Math.round((1 - all.successRate) * 50))
  assert.equal(all.withdrawalBands.length, 10)
})

test("histogram: one bar for every trial that ran out, the rest split by ending; slices filter the same trials", () => {
  const doc = plan(9_000)
  const h = history([-0.5, 0.1, 0.2, 0, -0.1, 0.3, 0.05, 0, 0, 0.1, 0.02, -0.2, 0.15])
  const trials = stressPaths(doc, h, 0, opts({ method: "block", trials: 80, blockLength: 3 })).map((p, i) => runPath(doc, h, p, 0, "plan", i))
  const y = { startValue: 100_000, yearlySpending: 9_000, endAge: 45, measure: "invested" as const }
  const bars = histogram(trials, y, "invested", 5)
  const failed = trials.filter((c) => c.depletedAge !== null).length
  assert.ok(failed > 0 && failed < trials.length, "the fixture has both")
  assert.equal(bars[0].slice.kind, "ranOut")
  assert.equal(bars[0].count, failed)
  assert.equal(bars.length, 6)
  assert.equal(bars.reduce((s, b) => s + b.count, 0), trials.length)
  for (const b of bars) assert.equal(trials.filter((c) => inSlice(c, b.slice)).length, b.count)
})

test("ending composition: grouped by net worth range, accounts plus property add up", () => {
  const trial = (accounts: number, netWorth: number, ranOut = false) =>
    ({ netWorth: [netWorth], invested: [accounts], depletedAge: ranOut ? 40 : null }) as unknown as CohortResult
  const trials = [...Array.from({ length: 10 }, () => trial(0, 500_000, true)), ...Array.from({ length: 10 }, () => trial(900_000, 1_000_000))]
  const groups = endingComposition(trials, 2)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].from, -Infinity)
  assert.equal(groups.at(-1)!.to, Infinity)
  assert.equal(groups.reduce((s, g) => s + g.count, 0), trials.length)
  assert.equal(groups[0].accountsShare, 0)
  assert.equal(groups[0].ranOut, 10)
  assert.equal(groups[1].accounts + groups[1].property, 10_000_000)
  assert.ok(Math.abs(groups[1].accountsShare! - 0.9) < 1e-12)
})

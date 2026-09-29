import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"
import { fireInputsSchema, mergeFireInputs } from "@/lib/fire/fire-schema"
import { buildBaseline, resolvePlan } from "@/lib/fire/fire-plan"
import { analyzePlan } from "@/lib/fire/fire-analysis"

const NET_WORTH = {
  totalNetWorth: 900_000,
  fiat: { cash: 20_000, savings: 50_000, investments: 600_000, debt: 10_000 },
  crypto: { value: 240_000 },
}

const TRENDS = [
  { month: "2026-07", income: 10_000, spending: 4_000 },
  { month: "2026-08", income: 10_000, spending: 6_000 },
  { month: "2026-09", income: 1_000, spending: 500 },
]

test("defaults satisfy the API schema (PUT of a fresh profile must validate)", () => {
  assert.ok(fireInputsSchema.safeParse(DEFAULT_FIRE_INPUTS).success)
})

test("mergeFireInputs: fills missing fields, falls back to defaults on garbage", () => {
  const merged = mergeFireInputs({ currentAge: 42, mode: "advanced" })
  assert.equal(merged.currentAge, 42)
  assert.equal(merged.mode, "advanced")
  assert.equal(merged.swrPreset, DEFAULT_FIRE_INPUTS.swrPreset)
  assert.deepEqual(mergeFireInputs({ currentAge: "old" }), DEFAULT_FIRE_INPUTS)
  assert.deepEqual(mergeFireInputs(null), DEFAULT_FIRE_INPUTS)
})

test("buildBaseline: skips the partial current month and annualizes", () => {
  const b = buildBaseline(NET_WORTH, TRENDS, null, "2026-09")
  assert.equal(b.monthsOfData, 2)
  assert.equal(b.avgAnnualSpend, 60_000)
  assert.equal(b.annualIncome, 120_000)
  assert.equal(b.annualContribution, 60_000)
  assert.equal(b.savingsRate, 0.5)
})

test("buildBaseline: income override wins over Income-category totals", () => {
  const b = buildBaseline(NET_WORTH, TRENDS, 20_000, "2026-09")
  assert.equal(b.annualIncome, 240_000)
  assert.equal(b.annualContribution, 180_000)
})

test("resolvePlan: investable honours cash/crypto toggles and overrides", () => {
  const baseline = buildBaseline(NET_WORTH, TRENDS, null, "2026-09")
  const auto = resolvePlan(DEFAULT_FIRE_INPUTS, baseline, 40)
  assert.equal(auto.investable, 600_000 + 50_000 + 240_000)
  assert.ok(auto.spendIsAuto && auto.investableIsAuto)
  const noCrypto = resolvePlan({ ...DEFAULT_FIRE_INPUTS, includeCrypto: false, includeCash: true }, baseline, 40)
  assert.equal(noCrypto.investable, 600_000 + 50_000 + 20_000)
  const manual = resolvePlan({ ...DEFAULT_FIRE_INPUTS, investableOverride: 1, annualSpend: 2 }, baseline, 40)
  assert.equal(manual.investable, 1)
  assert.equal(manual.annualSpend, 2)
})

test("resolvePlan: CAPE preset uses a + b/CAPE", () => {
  const baseline = buildBaseline(NET_WORTH, TRENDS, null, "2026-09")
  const plan = resolvePlan({ ...DEFAULT_FIRE_INPUTS, swrPreset: "cape" }, baseline, 40)
  assert.ok(Math.abs(plan.swr - (0.0175 + 0.5 / 40)) < 1e-12)
})

test("analyzePlan: tiers ordered by target and FI age consistent with years", () => {
  const baseline = buildBaseline(NET_WORTH, TRENDS, null, "2026-09")
  const inputs = { ...DEFAULT_FIRE_INPUTS, swrPreset: "4" as const }
  const a = analyzePlan(inputs, resolvePlan(inputs, baseline, 40), 2026)
  assert.equal(a.fireNumber, 60_000 / 0.04)
  const targets = a.tiers.map((t) => t.target)
  assert.deepEqual(targets, [...targets].sort((x, y) => x - y))
  assert.ok(a.yourTarget.years !== null && a.yourTarget.age !== null)
  // Lean ($1M) is below the $1.5M plan target, so it is reached first.
  assert.ok(a.tiers[0].years !== null && a.tiers[0].years > 0 && a.tiers[0].years < a.yourTarget.years)
  assert.ok(Math.abs(a.yourTarget.age - (inputs.currentAge + a.yourTarget.years)) < 1e-9)
  assert.ok(a.projection.length > 1)
})

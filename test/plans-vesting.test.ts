import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { defaultVesting, vestingByYear } from "@/lib/plans/plan-vesting"
import { applyEquity, initialEquityDraft } from "@/components/plans/editor/equity-helpers"
import type { PlanDocument, PlanIncome, VestingSchedule } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)

function close(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `Expected ${actual} ≈ ${expected}`)
}

function closeAll(actual: number[], expected: number[]) {
  assert.equal(actual.length, expected.length, `${actual} vs ${expected}`)
  actual.forEach((v, i) => close(v, expected[i]))
}

const schedule = (patch: Partial<VestingSchedule>): VestingSchedule => ({ ...defaultVesting(1), ...patch })

test("a 1-year cliff vests nothing in the grant's year, then a quarter at once on the anniversary", () => {
  // January grant, 4 years monthly: the cliff lands next January, the last month the January after year 4.
  closeAll(vestingByYear(schedule({})), [0, 23 / 48, 12 / 48, 12 / 48, 1 / 48])
  // A July grant: the cliff next July plus August to December, and the last 7 months in year 4.
  closeAll(vestingByYear(schedule({ grantMonth: 7 })), [0, 17 / 48, 12 / 48, 12 / 48, 7 / 48])
})

test("no cliff vests from the first month; yearly vesting lands on each anniversary", () => {
  closeAll(vestingByYear(schedule({ cliffMonths: 0 })), [11 / 48, 12 / 48, 12 / 48, 12 / 48, 1 / 48])
  closeAll(vestingByYear(schedule({ cliffMonths: 0, every: 12, grantMonth: 7 })), [0, 0.25, 0.25, 0.25, 0.25])
})

test("front- and back-loaded schedules vest each year's own share", () => {
  closeAll(vestingByYear(schedule({ yearly: [0.05, 0.15, 0.4, 0.4], every: 12, cliffMonths: 0 })), [0, 0.05, 0.15, 0.4, 0.4])
  // October grant, quarterly after a cliff: year 1's four quarters arrive together next October, and each later
  // grant year's quarters (January to October) fall in one calendar year.
  closeAll(vestingByYear(schedule({ yearly: [0.33, 0.33, 0.22, 0.12], every: 3, grantMonth: 10 })), [0, 0.33, 0.33, 0.22, 0.12])
})

test("shares that don't add up to 100% are scaled; every grant vests in full", () => {
  const total = vestingByYear(schedule({ yearly: [1, 1, 2] })).reduce((s, v) => s + v, 0)
  close(total, 1)
  closeAll(vestingByYear(schedule({ yearly: [1, 1, 2], every: 12, cliffMonths: 0 })), [0, 0.25, 0.25, 0.5])
})

function doc(incomes: PlanIncome[]): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [{ id: "cash", name: "Cash", taxTreatment: "cash", balance: 0, costBasis: null, returnRate: 0, owner: null, source: null }],
    incomes,
  }
}

function rsu(vesting: VestingSchedule, end: PlanIncome["end"] = { type: "planEnd" }): PlanIncome {
  return {
    id: "rsu",
    name: "RSUs",
    kind: "equity",
    amount: 0,
    growth: 0,
    start: { type: "planStart" },
    end,
    taxable: false,
    oneTime: false,
    contributions: [],
    equity: { symbol: null, shares: 400, price: 100, vesting },
  }
}

const vestsBy = (d: PlanDocument) => simulatePlan(d).rows.map((r) => r.incomeBy.rsu ?? 0)

test("the plan pays each year's vesting at that year's price", () => {
  const even = schedule({ every: 12, cliffMonths: 0 })
  const paid = vestsBy(doc([rsu(even)]))
  closeAll(paid.slice(0, 6), [0, 10_000, 10_000, 10_000, 10_000, 0])
})

test("leaving before the cliff forfeits everything; leaving later forfeits what hasn't vested", () => {
  const standard = schedule({})
  assert.equal(vestsBy(doc([rsu(standard, { type: "year", year: 2027 })])).reduce((s, v) => s + v, 0), 0)
  const paid = vestsBy(doc([rsu(standard, { type: "year", year: 2029 })]))
  close(paid.reduce((s, v) => s + v, 0), 40_000 * (23 / 48 + 12 / 48))
})

test("refreshers stack up to a whole grant a year, and stop being granted when you leave", () => {
  const refresh = schedule({ every: 12, cliffMonths: 0, refresh: true })
  const paid = vestsBy(doc([rsu(refresh)]))
  closeAll(paid.slice(0, 6), [0, 10_000, 20_000, 30_000, 40_000, 40_000])
  const left = vestsBy(doc([rsu(refresh, { type: "year", year: 2029 })]))
  // Gone in 2029: grants from 2026–2028 vested 2027 and 2028 only.
  closeAll(left.slice(0, 5), [0, 10_000, 20_000, 0, 0])
})

test("a refresher is worth the first grant's value, so it buys fewer shares after the price rises", () => {
  const refresh = schedule({ yearly: [1], every: 12, cliffMonths: 0, refresh: true })
  const income = { ...rsu(refresh), growth: 1 } // the price doubles every year
  const paid = vestsBy(doc([income]))
  // Each grant is $40k at grant and vests a year later at twice the price.
  closeAll(paid.slice(1, 4), [80_000, 80_000, 80_000])
})

test("new RSUs from the pop-out carry a standard schedule and validate", () => {
  const base = doc([])
  const d = applyEquity("rsu", { ...initialEquityDraft("rsu", base), kept: 0 }, base)
  const grant = d.incomes[0].equity
  assert.ok(grant?.vesting)
  assert.equal(grant.vesting.cliffMonths, 12)
  assert.equal(grant.shares, 800)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

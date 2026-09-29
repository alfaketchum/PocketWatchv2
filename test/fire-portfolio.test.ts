import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { buildAllocation, defaultMix, portfolioAccounts } from "@/lib/fire/fire-portfolio"
import { investableHistory } from "@/lib/fire/fire-history"
import { categoryCosts } from "@/lib/fire/fire-spending-cost"
import { analyzePlan, oneMoreYear } from "@/lib/fire/fire-analysis"
import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"
import { constantEquity, defaultSimOptions, failsafe, maxSafeWr, parseDataset, summarizeCohorts } from "@/lib/fire/swr-simulation"
import type { MarketHistory, ShillerDataset } from "@/lib/fire/fire-types"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

const real = parseDataset(
  JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data/shiller-monthly.json"), "utf8")) as ShillerDataset,
)

const INSTITUTIONS = [
  {
    institutionName: "Broker",
    provider: "plaid",
    accounts: [
      { id: "b1", name: "Brokerage", type: "investment", subtype: "brokerage", currentBalance: 600, isHidden: false, linkedExternalId: null },
      { id: "k1", name: "401k", type: "investment", subtype: "401k", currentBalance: 200, isHidden: false, linkedExternalId: null },
      { id: "h1", name: "Hidden", type: "investment", subtype: "brokerage", currentBalance: 999, isHidden: true, linkedExternalId: null },
      { id: "c1", name: "Card", type: "credit", subtype: "credit card", currentBalance: 50, isHidden: false, linkedExternalId: null },
    ],
  },
  {
    institutionName: "Bank",
    provider: "simplefin",
    accounts: [
      { id: "s1", name: "Savings", type: "savings", subtype: "savings", currentBalance: 100, isHidden: false, linkedExternalId: null },
      { id: "ck", name: "Checking", type: "checking", subtype: "checking", currentBalance: 40, isHidden: false, linkedExternalId: null },
      { id: "dup", name: "Dup", type: "savings", subtype: "savings", currentBalance: 100, isHidden: false, linkedExternalId: "x" },
    ],
  },
]

test("portfolioAccounts: filters hidden, debt, and SimpleFIN duplicates like net worth", () => {
  const ids = portfolioAccounts(INSTITUTIONS).map((a) => a.id).sort()
  assert.deepEqual(ids, ["b1", "ck", "k1", "s1"])
})

test("buildAllocation: defaults, mixes, toggles, crypto treatment, runway", () => {
  const accounts = portfolioAccounts(INSTITUTIONS)
  const base = {
    accounts, stablecoins: 50, digital: 50, mixes: {}, includeCash: false, includeCrypto: true,
    cryptoTreatment: "stocks" as const, annualSpend: 75,
  }
  const a = buildAllocation(base)
  assert.equal(a.total, 600 + 200 + 100 + 50 + 50)
  assert.equal(a.byClass.stocks, 800)
  assert.equal(a.byClass.cash, 100, "savings counts as cash; checking excluded when includeCash is off")
  assertClose(a.sim.stocks + a.sim.bonds + a.sim.cash, 1, 1e-12)
  assertClose(a.sim.stocks, 850 / 1000, 1e-12)
  assertClose(a.cashRunwayYears ?? 0, 150 / 75, 1e-12)

  const mixed = buildAllocation({ ...base, mixes: { k1: { stocks: 0.5, bonds: 0.5, cash: 0 } }, cryptoTreatment: "cash" })
  assert.equal(mixed.byClass.bonds, 100)
  assertClose(mixed.sim.cash, (100 + 50 + 50) / 1000, 1e-12)

  const noCrypto = buildAllocation({ ...base, includeCrypto: false, includeCash: true })
  assert.equal(noCrypto.byClass.crypto, 0)
  assert.equal(noCrypto.total, 940)
  assert.deepEqual(defaultMix("investments"), { stocks: 1, bonds: 0, cash: 0 })
})

test("cash sleeve: 100% cash at 0% real return depletes linearly (WR = 1/horizon)", () => {
  const opts = defaultSimOptions({ horizonMonths: 360, equity: constantEquity(0, 1), feeAnnual: 0 })
  assertClose(maxSafeWr(real, 0, opts), 1 / 30, 1e-12)
})

test("cash sleeve: holding 20% cash lowers the 60-year failsafe", () => {
  const noCash = failsafe(summarizeCohorts(real, defaultSimOptions({ horizonMonths: 720, equity: constantEquity(0.8) })))!
  const withCash = failsafe(summarizeCohorts(real, defaultSimOptions({ horizonMonths: 720, equity: constantEquity(0.8, 0.2) })))!
  assert.ok(withCash.wr < noCash.wr, `${withCash.wr} should be < ${noCash.wr}`)
})

test("investableHistory: respects toggles and keeps one point per month", () => {
  const pts = investableHistory(
    [
      { date: "2026-01-05", cash: 10, savings: 20, investment: 100, stablecoin: 5, digital: 5 },
      { date: "2026-01-28", cash: 10, savings: 20, investment: 110, stablecoin: 5, digital: 5 },
      { date: "2026-02-10", cash: 10, savings: 20, investment: 120, stablecoin: 5, digital: 5 },
    ],
    false,
    true,
  )
  assert.equal(pts.length, 2)
  assert.equal(pts[0].value, 110 + 20 + 10)
  assert.ok(pts[0].x < pts[1].x)
})

test("categoryCosts: nest egg = annual/SWR, and cutting a category gets you there sooner", () => {
  const months = [
    { month: "2026-07", categories: { Dining: 500, Rent: 2000 } },
    { month: "2026-08", categories: { Dining: 700, Rent: 2000 } },
    { month: "2026-09", categories: { Dining: 9999 } },
  ]
  const plan = { investable: 300_000, annualSpend: 60_000, annualContribution: 40_000, swr: 0.04, realReturn: 0.05 }
  const costs = categoryCosts(months, "2026-09", plan)
  assert.deepEqual(costs.map((c) => c.category), ["Rent", "Dining"])
  const dining = costs[1]
  assert.equal(dining.monthly, 600)
  assert.equal(dining.nestEgg, 7200 / 0.04)
  assert.ok(dining.yearsSooner !== null && dining.yearsSooner > 0)
})

test("oneMoreYear: success rate never falls and safe spend rises with extra years", () => {
  const inputs = { ...DEFAULT_FIRE_INPUTS, swrPreset: "4" as const, horizonYears: 50 }
  const plan = { investable: 500_000, annualSpend: 60_000, annualContribution: 50_000, swr: 0.04, spendIsAuto: false, contributionIsAuto: false, investableIsAuto: false }
  const analysis = analyzePlan(inputs, plan, 2026)
  const rows = oneMoreYear(inputs, analysis, plan, real as MarketHistory, null, 3)
  assert.equal(rows.length, 4)
  for (let i = 1; i < rows.length; i++) {
    assert.ok((rows[i].successRate ?? 0) >= (rows[i - 1].successRate ?? 0))
    assert.ok((rows[i].safeSpend ?? 0) > (rows[i - 1].safeSpend ?? 0))
  }
  assertClose(rows[0].withdrawalRate, 0.04, 1e-9)
})

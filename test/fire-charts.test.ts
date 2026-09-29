import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { growthSplit, savingsRateCurve } from "@/lib/fire/fire-growth"
import { richBrokeDead, survival, type LifeTable } from "@/lib/fire/rich-broke-dead"
import { comparePeers, type ScfData } from "@/lib/fire/scf-peers"
import { buildCashFlowSankey } from "@/lib/finance/cash-flow-sankey"
import { constantEquity, defaultSimOptions, parseDataset } from "@/lib/fire/swr-simulation"
import type { ShillerDataset } from "@/lib/fire/fire-types"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

const load = <T,>(file: string) => JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data", file), "utf8")) as T
const real = parseDataset(load<ShillerDataset>("shiller-monthly.json"))
const life = load<LifeTable>("us-life-table.json")
const scf = load<ScfData>("scf-networth.json")

test("growth split: market overtakes contributions once portfolio × r exceeds them; stops at FI", () => {
  const g = growthSplit(100_000, 50_000, 0.05, 2_000_000, 40, 2026)
  assert.ok(g.crossoverYear !== null)
  const first = g.years.find((y) => y.year === g.crossoverYear)!
  assert.ok(first.market > first.contributed)
  assert.ok(g.years.some((y) => y.contributed === 0), "contributions stop after reaching the target")
  assert.equal(growthSplit(2_000_000, 10_000, 0.05, 5_000_000, 5, 2026).crossoverYear, 2026)
})

test("savings-rate curve: higher savings rate → fewer years; current point lies on the curve", () => {
  const { points, current } = savingsRateCurve(0, 50_000, 50_000, 0.05, 0.04)
  const ys = points.map((p) => p.years ?? Infinity)
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] <= ys[i - 1])
  const fifty = points.find((p) => Math.abs(p.rate - 0.5) < 1e-9)!
  assertClose(current!.years!, fifty.years!, 1e-9)
  assertClose(fifty.years!, 17, 1, "MMM: 50% savings rate from zero ≈ 17 years")
})

test("life table: plausible survival; male < female", () => {
  assert.equal(life.total.length, 101)
  const m = survival(life.male, 45, 40)
  const f = survival(life.female, 45, 40)
  assert.ok(m < f && m > 0.3 && f < 0.8, `${m} ${f}`)
})

test("rich/broke/dead: rows sum to 1, death rises with age", () => {
  const opts = defaultSimOptions({ horizonMonths: 50 * 12, equity: constantEquity(0.8) })
  const rows = richBrokeDead(real, opts, 0.04, 45, life.total)
  assert.ok(rows.length > 40)
  for (const r of rows) assertClose(r.dead + r.broke + r.below + r.above, 1, 1e-9)
  assert.ok(rows[rows.length - 1].dead > rows[5].dead)
  assert.equal(rows[0].dead, 0)
})

test("SCF peers: median maps to the 50th percentile; published medians match", () => {
  const c = comparePeers(scf, 40, 135_300)!
  assert.deepEqual(c.ages, [35, 44])
  assertClose(c.percentile, 50, 0.5)
  assert.equal(comparePeers(scf, 30, 1e9)!.percentile, 99)
  assertClose(scf.groups[0].values[scf.percentiles.indexOf(50)], 39_040, 1, "Fed published under-35 median $39,040")
})

test("cash-flow sankey: income splits into categories + saved; shortfall shows as From savings", () => {
  const months = [
    { month: "2026-07", income: 8_000, spending: 5_000, categories: { Rent: 3_000, Food: 2_000 } },
    { month: "2026-08", income: 8_000, spending: 5_000, categories: { Rent: 3_000, Food: 2_000 } },
    { month: "2026-09", income: 1, spending: 1, categories: { Rent: 1 } },
  ]
  const s = buildCashFlowSankey(months, "2026-09", null)!
  assert.equal(s.months, 2)
  const saved = s.nodes.findIndex((n) => n.kind === "saved")
  assert.equal(s.links.find((l) => l.target === saved)!.value, 3_000)
  const short = buildCashFlowSankey(months, "2026-09", 4_000)!
  assert.ok(short.nodes.some((n) => n.name === "From savings"))
  assert.ok(!short.nodes.some((n) => n.kind === "saved"))
})

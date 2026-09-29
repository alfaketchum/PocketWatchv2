import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { classifyCryptoSymbol, summarizeTiers } from "@/lib/fire/crypto-tiers"
import {
  CRYPTO_PRESETS,
  crashAtRetirement,
  cryptoLoss,
  resolveDrops,
  riskWeightedCrypto,
  scaleTiers,
  stressSummary,
} from "@/lib/fire/crypto-stress"
import { buildAllocation } from "@/lib/fire/fire-portfolio"
import { constantEquity, defaultSimOptions, parseDataset } from "@/lib/fire/swr-simulation"
import type { ShillerDataset } from "@/lib/fire/fire-types"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

const real = parseDataset(
  JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data/shiller-monthly.json"), "utf8")) as ShillerDataset,
)
const TOP = new Set(["BTC", "ETH", "USDT", "SOL", "LINK", "XRP"])
const TIERS = { btc: 100_000, eth: 50_000, top100: 30_000, longTail: 10_000, stable: 10_000 }

test("classifyCryptoSymbol: wrapped BTC, LSTs, aTokens, stables, top-100, long tail", () => {
  for (const s of ["BTC", "WBTC", "cbBTC", "tBTC", "aWBTC"]) assert.equal(classifyCryptoSymbol(s, TOP), "btc", s)
  for (const s of ["ETH", "WETH", "stETH", "wstETH", "weETH", "rETH"]) assert.equal(classifyCryptoSymbol(s, TOP), "eth", s)
  for (const s of ["USDC", "USDT", "DAI", "PYUSD"]) assert.equal(classifyCryptoSymbol(s, TOP), "stable", s)
  assert.equal(classifyCryptoSymbol("SOL", TOP), "top100")
  assert.equal(classifyCryptoSymbol("link", TOP), "top100")
  assert.equal(classifyCryptoSymbol("MOONDOG", TOP), "longTail")
  assert.equal(classifyCryptoSymbol("SOL", new Set()), "longTail", "rank comes only from the top-100 set")
})

test("summarizeTiers: sums per tier, skips loans and zero values, lists largest symbols", () => {
  const s = summarizeTiers(
    [
      { symbol: "WBTC", value: 60, positionType: "wallet" },
      { symbol: "BTC", value: 40, positionType: "exchange" },
      { symbol: "USDC", value: 500, positionType: "loan" },
      { symbol: "SOL", value: 30, positionType: "staked" },
      { symbol: "PEPE2", value: 0, positionType: "wallet" },
      { symbol: "MOONDOG", value: 5, positionType: "wallet" },
    ],
    TOP,
  )
  assert.deepEqual(s.tiers, { btc: 100, eth: 0, top100: 30, longTail: 5, stable: 0 })
  assert.deepEqual(s.examples.btc, ["WBTC", "BTC"])
})

test("presets, scaling and risk-weighted value", () => {
  assert.deepEqual(resolveDrops("cautious", CRYPTO_PRESETS.full), CRYPTO_PRESETS.cautious)
  const custom = { btc: 0.1, eth: 0.2, top100: 0.3, longTail: 0.4 }
  assert.deepEqual(resolveDrops("custom", custom), custom)

  const scaled = scaleTiers(TIERS, 400_000)
  assertClose(Object.values(scaled).reduce((a, b) => a + b, 0), 400_000, 1e-6)
  assertClose(scaled.btc / scaled.eth, 2, 1e-12)

  const loss = cryptoLoss(TIERS, CRYPTO_PRESETS.cautious)
  assertClose(loss, 100_000 * 0.75 + 50_000 * 0.85 + 30_000 * 0.9 + 10_000, 1e-6)
  assertClose(riskWeightedCrypto(TIERS, CRYPTO_PRESETS.cautious), 200_000 - loss, 1e-6)
  assert.equal(cryptoLoss(TIERS, CRYPTO_PRESETS.full), 0)
})

test("allocation uses tiers scaled to the net-worth crypto total", () => {
  const a = buildAllocation({
    accounts: [], stablecoins: 20_000, digital: 380_000, mixes: {}, includeCash: false, includeCrypto: true,
    cryptoTreatment: "stocks", annualSpend: 40_000, cryptoTiers: TIERS,
  })
  assertClose(a.total, 400_000, 1e-6)
  assertClose(a.byClass.btc, 200_000, 1e-6)
  assert.equal(a.byClass.crypto, 0)
  assertClose(a.sim.cash, a.byClass.stablecoins / a.total, 1e-12)
})

test("crash at retirement: identity at 0 loss, worse when crypto crashes", () => {
  const opts = defaultSimOptions({ horizonMonths: 600, equity: constantEquity(0.8) })
  const none = crashAtRetirement(real, opts, 1_500_000, 60_000, 0)
  assertClose(none.withdrawalRate, 0.04, 1e-12)
  const hit = crashAtRetirement(real, opts, 1_500_000, 60_000, 0.15)
  assert.ok((hit.successRate ?? 1) < (none.successRate ?? 0))
  assert.ok((hit.safeSpend ?? Infinity) < (none.safeSpend ?? 0))
  assert.equal(crashAtRetirement(real, opts, 1_500_000, 60_000, 1).successRate, 0)
})

test("risk-weighted FI date is later than the full-value one when crypto is held", () => {
  const plan = { investable: 800_000, annualContribution: 50_000 }
  const full = stressSummary(TIERS, CRYPTO_PRESETS.full, plan, 1_500_000, 0.05)
  const cautious = stressSummary(TIERS, CRYPTO_PRESETS.cautious, plan, 1_500_000, 0.05)
  assert.ok(full.stressedYears !== null && cautious.stressedYears !== null)
  assert.ok(cautious.stressedYears > full.stressedYears)
  assertClose(cautious.lossFraction, cautious.loss / 800_000, 1e-12)
})

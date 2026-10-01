import test from "node:test"
import assert from "node:assert/strict"
import "./setup-env"
import { assetValueForDay } from "@/lib/portfolio/asset-composition-values"
import { buildAssetHistory, missingAssetPairs } from "@/lib/portfolio/wallet-chart-cache"

const day = 86_400
const existing = { address: "0xAAA", symbol: "ETH", fungibleId: "eth-id" }
const added = { address: "0xBBB", symbol: "ETH", fungibleId: "eth-id" }
const today = new Map([["ETH", 240]])

test("a newly added wallet requires its own Zerion backfill for an existing asset", () => {
  const stored = [{ address: "0xaaa", series: "asset:eth-id" }]
  assert.deepEqual(missingAssetPairs([existing, added], stored), [added])
  assert.deepEqual(missingAssetPairs([existing, added], [
    ...stored, { address: "0xbbb", series: "asset:eth-id" },
  ]), [])
})

test("asset history includes the new wallet after its series is stored", () => {
  const rows = [
    { address: "0xaaa", series: "asset:eth-id", timestamp: day, value: 100 },
    { address: "0xaaa", series: "asset:eth-id", timestamp: 2 * day, value: 120 },
  ]
  const before = buildAssetHistory([existing, added], rows)
  assert.equal(before.missing, 1)
  const after = buildAssetHistory([existing, added], [
    ...rows,
    { address: "0xbbb", series: "asset:eth-id", timestamp: day, value: 50 },
    { address: "0xbbb", series: "asset:eth-id", timestamp: 2 * day, value: 70 },
  ])
  assert.equal(after.missing, 0)
  assert.deepEqual(after.bySymbol.get("ETH"), [[day, 150], [2 * day, 190]])
})

test("future asset days prefer snapshots, then current balances; missing days carry last history", () => {
  assert.equal(assetValueForDay("2026-09-29", "2026-10-01", "ETH", today, undefined, 190), 190)
  assert.equal(assetValueForDay("2026-09-30", "2026-10-01", "ETH", today, { ETH: 210 }, 190), 210)
  assert.equal(assetValueForDay("2026-10-01", "2026-10-01", "ETH", today, undefined, 190), 240)
})

import test from "node:test"
import assert from "node:assert/strict"
import { cardUtilization, creditScoreCreateSchema, scoreTier } from "@/lib/finance/credit-scores"

test("scoreTier follows FICO's ranges at every boundary", () => {
  const cases: [number, string][] = [[300, "poor"], [579, "poor"], [580, "fair"], [669, "fair"], [670, "good"], [739, "good"], [740, "very-good"], [799, "very-good"], [800, "exceptional"], [850, "exceptional"]]
  for (const [score, key] of cases) assert.equal(scoreTier(score).key, key, `${score}`)
})

test("cardUtilization: all balances over all limits; cards without a limit are left out", () => {
  const u = cardUtilization([
    { name: "A", currentBalance: -500, creditLimit: 5_000 },
    { name: "B", currentBalance: 1_500, creditLimit: 5_000 },
    { name: "C", currentBalance: 900, creditLimit: null },
    { name: "D", currentBalance: 100, creditLimit: 0 },
  ])
  assert.equal(u.overall, 0.2)
  assert.deepEqual(u.cards.map((c) => [c.name, c.balance, c.share]), [["A", 500, 0.1], ["B", 1_500, 0.3]])
  assert.equal(cardUtilization([]).overall, null)
})

test("create schema: whole scores 300–850, no future dates", () => {
  const ok = { score: 742, model: "fico8", date: "2026-09-01" }
  assert.ok(creditScoreCreateSchema.safeParse(ok).success)
  assert.ok(!creditScoreCreateSchema.safeParse({ ...ok, score: 299 }).success)
  assert.ok(!creditScoreCreateSchema.safeParse({ ...ok, score: 742.5 }).success)
  assert.ok(!creditScoreCreateSchema.safeParse({ ...ok, model: "made-up" }).success)
  assert.ok(!creditScoreCreateSchema.safeParse({ ...ok, date: "2099-01-01" }).success)
})

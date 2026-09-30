import test from "node:test"
import assert from "node:assert/strict"
import { totalsAt, valueAt, type ValuedAsset } from "@/lib/finance/real-assets"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { assetsFromRealAssets } from "@/lib/plans/import/import-mapping"
import { applyLoanAsAsset, applyOwnedAsset, ignoreKnownAsset, loanSuggestions, type KnownAsset } from "@/lib/plans/plan-loan-matching"
import { applySourceBalances } from "@/lib/plans/plan-refresh"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanDebt } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

const house: ValuedAsset = {
  kind: "home", value: 600_000, valueAsOf: d("2026-09-30"), appreciation: 0.03,
  purchasePrice: 500_000, purchaseDate: d("2022-09-30"), values: [{ date: d("2024-09-30"), value: 550_000 }],
}

test("value is zero before it was bought, then the last known value moved by the yearly change", () => {
  assert.equal(valueAt(house, d("2022-01-01")), 0)
  close(valueAt(house, d("2023-09-30")), 500_000 * 1.03, 200)
  close(valueAt(house, d("2025-09-30")), 550_000 * 1.03, 200)
  close(valueAt(house, d("2027-09-30")), 600_000 * 1.03, 200)
})

test("with no purchase date, nothing is counted before it was first entered", () => {
  const car: ValuedAsset = { kind: "vehicle", value: 30_000, valueAsOf: d("2026-09-30"), appreciation: -0.15, purchasePrice: null, purchaseDate: null, values: [] }
  assert.equal(valueAt(car, d("2026-09-01")), 0)
  close(valueAt(car, d("2026-09-30")), 30_000)
  const t = totalsAt([house, car], d("2026-09-30"))
  close(t.home, 600_000)
  close(t.vehicle, 30_000)
  close(t.total, 630_000)
})

const mortgage: PlanDebt = {
  id: "debt-m1", name: "Mortgage", kind: "mortgage", balance: 400_000, rate: 0.06, monthlyPayment: 2_600,
  start: { type: "planStart" }, assetId: null, source: { kind: "finance-account", refId: "m1" },
}
const known = (id: string, loanAccountId: string | null, kind = "home"): KnownAsset => ({ id, kind, name: `Home ${id}`, value: 600_000, appreciation: 0.03, loanAccountId })

test("importing: homes and vehicles come in owned now, linked to their loan, and refresh updates their value", () => {
  const { assets, debts } = assetsFromRealAssets([known("r1", "m1")], [mortgage])
  assert.equal(debts[0].assetId, assets[0].id)
  assert.deepEqual(assets[0].source, { kind: "real-asset", refId: "r1" })
  const plan = { ...blankPlanDocument(new Date(2026, 8, 1)), assets, debts }
  assert.ok(planDocumentSchema.safeParse(plan).success)
  const refreshed = applySourceBalances(plan, { accounts: {}, crypto: 0, realAssets: { r1: 640_000 } }, new Date(2026, 9, 1))
  assert.equal(refreshed.assets[0].value, 640_000)
})

test("suggestions use what was entered: a loan's own home, and homes with no loan", () => {
  const plan = blankPlanDocument(new Date(2026, 8, 1))
  const s = loanSuggestions(plan, [mortgage], [known("r1", "m1"), known("r2", null, "vehicle")])
  assert.deepEqual(s.map((x) => x.type), ["addAsset", "addOwned"])
  assert.equal(s[0].type === "addAsset" ? s[0].known?.id : null, "r1")
  const withLoan = s[0].type === "addAsset" ? applyLoanAsAsset(plan, mortgage, "home", 600_000, (p) => `${p}-1`, s[0].known) : plan
  assert.deepEqual(withLoan.assets[0].source, { kind: "real-asset", refId: "r1" })
  assert.equal(withLoan.debts[0].assetId, withLoan.assets[0].id)
  const owned = s[1].type === "addOwned" ? applyOwnedAsset(plan, s[1].asset, (p) => `${p}-2`) : plan
  assert.equal(owned.assets[0].kind, "vehicle")
  // Once in the plan, or dismissed, they aren't suggested again.
  assert.equal(loanSuggestions(owned, [], [known("r2", null, "vehicle")]).length, 0)
  assert.equal(loanSuggestions(ignoreKnownAsset(plan, known("r2", null)), [], [known("r2", null)]).length, 0)
})

import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { planCreditPath, projectScores, projectedScoreAt } from "@/lib/plans/credit-projection"
import { autoRateAt, mortgageAdjustment, mortgageRateAt, REFERENCE_SCORE } from "@/lib/plans/credit-rates"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { monthlyPayment } from "@/lib/plans/plan-debt-payments"
import { expandPlan } from "@/lib/plans/plan-expand"
import { TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanCredit, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

/** Plan starts 2026 at 40, runs to 70. */
function plan(credit: PlanCredit | undefined, assets: PlanAsset[] = [], debts: PlanDebt[] = []): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return { ...base, settings: { ...base.settings, endAge: 70, ...(credit ? { credit } : {}) }, assets, debts }
}
const home = (mode: "undecided" | "loan"): PlanAsset => ({
  id: "h", name: "Home", kind: "home", value: 500_000, appreciation: 0.03, start: { type: "year", year: 2031 }, end: { type: "planEnd" },
  financing: { mode, downShare: 0.2, rate: 0.065, termYears: 30 },
})
const card = (balance: number): PlanDebt => ({
  id: "c", name: "Card", kind: "credit", balance, rate: 0.22, monthlyPayment: 500, start: { type: "planStart" }, assetId: null, source: null,
})
const credit = (score: number, cardLimit?: number): PlanCredit => ({ score, asOf: "2026-01-10", ...(cardLimit ? { cardLimit } : {}) })

test("rate tables: steps at their boundaries, and the reference score moves nothing", () => {
  close(mortgageRateAt(780), 0.0685)
  close(mortgageRateAt(779), 0.0693)
  close(mortgageRateAt(500), 0.0761)
  close(mortgageAdjustment(REFERENCE_SCORE), 0)
  assert.ok(mortgageAdjustment(800) < 0 && mortgageAdjustment(650) > 0)
  assert.ok(Math.abs(mortgageAdjustment(620, 15)) < 0.001, "15-year rates barely depend on score")
  close(autoRateAt(800, false), 0.0441)
  close(autoRateAt(700, true), 0.0881)
})

test("projection: ages upward, slower past 760, capped", () => {
  const path = projectScores(plan(credit(700)), [], credit(700))
  assert.equal(path[0].score, 700)
  assert.equal(path[1].score, 704)
  assert.ok(path[20].score > 760 && path[20].score <= 820)
  assert.equal(projectScores(plan(credit(840)), [], credit(840))[10].score, 840, "a score above the cap isn't pulled down")
})

test("projection: a new loan dips the year it opens and recovers; the lender sees the score before it", () => {
  const d = plan(credit(700), [home("undecided")])
  const path = planCreditPath(d)!
  const y = path[5]
  assert.deepEqual(y.events, ["New loan: Home mortgage"])
  assert.equal(y.score, y.pricing - 10)
  assert.equal(path[6].score, path[6].pricing)
})

test("projection: card balances over 30% of limits weigh on it until they're paid down", () => {
  const path = projectScores(plan(credit(700, 10_000)), [card(5_000)], credit(700, 10_000))
  assert.ok(path[0].events.includes("Card balances over 30% of limits"))
  assert.equal(path[0].score, 670)
  assert.equal(path[3].events.length, 0)
  assert.equal(projectScores(plan(credit(700)), [card(5_000)], credit(700))[0].score, 700, "no limits known: not counted")
})

test("an undecided home is priced from the projected score; a loan you set keeps its rate", () => {
  const strong = expandPlan(plan(credit(800), [home("undecided")])).debts.find((x) => x.id === "fin-h")!
  const weak = expandPlan(plan(credit(640), [home("undecided")])).debts.find((x) => x.id === "fin-h")!
  const none = expandPlan(plan(undefined, [home("undecided")])).debts.find((x) => x.id === "fin-h")!
  close(none.rate, TYPICAL_FINANCING.home.rate)
  close(strong.rate, TYPICAL_FINANCING.home.rate + mortgageAdjustment(projectedScoreAt(plan(credit(800), [home("undecided")]), { type: "year", year: 2031 })!))
  assert.ok(weak.rate > none.rate && strong.rate < none.rate)
  assert.ok(weak.monthlyPayment > strong.monthlyPayment)
  const fixed = expandPlan(plan(credit(640), [home("loan")])).debts.find((x) => x.id === "fin-h")!
  close(fixed.rate, 0.065)
})

test("plans without a score parse, simulate and have no projection", () => {
  const mortgage: PlanDebt = { id: "m", name: "M", kind: "mortgage", balance: 300_000, rate: 0.06, monthlyPayment: monthlyPayment(300_000, 0.06, 360), start: { type: "planStart" }, assetId: null, source: null }
  const d = plan(undefined, [home("undecided")], [mortgage])
  assert.ok(planDocumentSchema.safeParse(d).success)
  assert.ok(planDocumentSchema.safeParse(plan(credit(720, 20_000))).success)
  assert.equal(planCreditPath(d), null)
  const rows = simulatePlan(d).rows
  assert.ok(rows.length > 0)
})

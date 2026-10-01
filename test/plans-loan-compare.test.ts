import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { loanSchedule } from "@/lib/plans/plan-amortization"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { monthlyPayment } from "@/lib/plans/plan-debt-payments"
import { expandPlan } from "@/lib/plans/plan-expand"
import { breakEvenReturn, compareLoanOptions, loanOutcome } from "@/lib/plans/plan-loan-compare"
import { loanChoices, loanOptions, payoffExtra, termRates, TERM_SPREADS, withLoanOption } from "@/lib/plans/plan-loan-options"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const INFLATION = 0.03

/** Plan starts 2026 at 40, runs to 80; no taxes; income covers the loan with room to spare. */
function plan(debts: PlanDebt[], assets: PlanAsset[] = [], returnRate = 0.06): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: INFLATION, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    accounts: [{ ...base.accounts[0], taxTreatment: "taxable", balance: 50_000, returnRate, costBasis: 50_000 }],
    incomes: [{ id: "w", name: "Salary", kind: "salary", amount: 120_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }],
    expenses: [],
    assets,
    debts,
  }
}
const mortgage = (extra: Partial<PlanDebt> = {}): PlanDebt => ({
  id: "m", name: "Mortgage", kind: "mortgage", balance: 300_000, rate: 0.065, monthlyPayment: monthlyPayment(300_000, 0.065, 360), start: { type: "planStart" }, assetId: null, source: null, ...extra,
})
const futureHome: PlanAsset = {
  id: "h", name: "Home", kind: "home", value: 500_000, appreciation: 0.03, start: { type: "year", year: 2030 }, end: { type: "planEnd" },
  financing: { mode: "loan", downShare: 0.2, rate: 0.07, termYears: 30 },
}

test("extra each month pays the loan off sooner; the engine and the schedule agree", () => {
  const d = plan([mortgage({ extraMonthly: 500 })])
  const schedule = loanSchedule(expandPlan(d), "m")!
  assert.ok(schedule.payoffYear! < 2055, `paid off ${schedule.payoffYear}`)
  const rows = simulatePlan(d).rows
  for (const y of schedule.years) close(y.payment, rows[y.index].debtPaymentsBy.m)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("payoff targets: the extra that clears a 30-year loan in exactly 15 years", () => {
  const [choice] = loanChoices(plan([mortgage()]))
  assert.equal(choice.yearsLeft, 30)
  const extra = payoffExtra(choice, 15)!
  close(choice.required + extra, monthlyPayment(300_000, 0.065, 180))
  const schedule = loanSchedule(expandPlan(withLoanOption(plan([mortgage()]), choice, { key: "payoff", years: 15, extraMonthly: extra })), "m")!
  assert.equal(schedule.payoffYear, 2040)
  const keys = loanOptions(choice, 200, termRates(choice)).map((o) => (o.key === "payoff" ? `payoff${o.years}` : o.key))
  assert.deepEqual(keys, ["planned", "extra", "payoff10", "payoff15", "payoff20"], "no term choices on a loan you already have")
})

test("prepaying wins when investments earn nothing, investing wins when they earn a lot", () => {
  for (const [rate, prepayWins] of [[0, true], [0.15, false]] as const) {
    const d = plan([mortgage()], [], rate)
    const [choice] = loanChoices(d)
    const [planned, prepaid] = compareLoanOptions(d, choice, [{ key: "planned" }, { key: "payoff", years: 15, extraMonthly: payoffExtra(choice, 15)! }])
    assert.ok(prepaid.interest < planned.interest)
    assert.equal(prepaid.netWorthEnd > planned.netWorthEnd, prepayWins, `at ${rate}`)
  }
})

test("with no taxes, investing needs to earn about the loan's rate to come out ahead", () => {
  const d = plan([mortgage()])
  const [choice] = loanChoices(d)
  const breakEven = breakEvenReturn(d, choice, { key: "payoff", years: 15, extraMonthly: payoffExtra(choice, 15)! })!
  assert.ok(breakEven > 0.06 && breakEven < 0.072, `break-even ${breakEven}`)
})

test("a planned purchase's loan: term choices at their own rates, written to the asset's financing", () => {
  const d = plan([], [futureHome])
  const [choice] = loanChoices(d)
  assert.equal(choice.id, "fin-h")
  assert.equal(choice.termYears, 30)
  const rates = termRates(choice)
  close(rates[15], 0.07 - TERM_SPREADS[15], 1e-9)
  const options = loanOptions(choice, 0, rates)
  assert.deepEqual(options.filter((o) => o.key === "term").map((o) => o.key === "term" && o.years), [15, 20])
  const fifteen = loanOutcome(d, choice, { key: "term", years: 15, rate: rates[15] })
  const planned = loanOutcome(d, choice, { key: "planned" })
  assert.ok(fifteen.payment > planned.payment)
  assert.equal(fifteen.payoffYear, 2044)
  assert.ok(fifteen.interest < planned.interest / 2)
  assert.equal(fifteen.doc.assets[0].financing?.termYears, 15)
})

test("extra on a planned purchase is stored in today's dollars and paid in the purchase year's", () => {
  const d = plan([], [futureHome])
  const [choice] = loanChoices(d)
  const variant = withLoanOption(d, choice, { key: "extra", extraMonthly: 1_000 })
  close(variant.assets[0].financing!.extraMonthly!, 1_000 / Math.pow(1 + INFLATION, 4))
  close(expandPlan(variant).debts.find((x) => x.id === "fin-h")!.extraMonthly!, 1_000)
})

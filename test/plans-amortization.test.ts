import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { loanSchedule, scheduleInBasis } from "@/lib/plans/plan-amortization"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { HELOC_DEFAULTS, monthlyPayment, scheduledPayment } from "@/lib/plans/plan-debt-payments"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const INFLATION = 0.03

/** Plan starts 2026 at age 40 and runs to 90; no taxes, $1M cash. */
function plan(debts: PlanDebt[], assets: PlanAsset[] = [], extra: Partial<PlanDocument["settings"]> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: INFLATION, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90, ...extra },
    accounts: [{ ...base.accounts[0], balance: 1_000_000, returnRate: 0 }],
    assets,
    debts,
  }
}

const PAYMENT = monthlyPayment(400_000, 0.065, 360)
const mortgage = (extra: Partial<PlanDebt> = {}): PlanDebt => ({
  id: "m", name: "Mortgage", kind: "mortgage", balance: 400_000, rate: 0.065, monthlyPayment: PAYMENT, start: { type: "planStart" }, assetId: null, source: null, ...extra,
})
const heloc = (extra: Partial<PlanDebt> = {}): PlanDebt => ({
  id: "l", name: "HELOC", kind: "heloc", balance: 100_000, rate: 0.08, monthlyPayment: 0, start: { type: "year", year: 2028 }, assetId: "h", source: null, heloc: HELOC_DEFAULTS, ...extra,
})
const home = (extra: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "h", name: "Home", kind: "home", value: 600_000, appreciation: 0.03, start: { type: "planStart" }, end: { type: "planEnd" }, ...extra,
})

test("the textbook loan: $400k at 6.5% for 30 years", () => {
  close(PAYMENT, 2528.27)
  const s = loanSchedule(plan([mortgage()]), "m")!
  const first = s.years[0].months[0]
  close(first.interest, 400_000 * 0.065 / 12)
  close(first.principal, PAYMENT - first.interest)
  assert.equal(s.years.length, 30)
  assert.equal(s.payoffYear, 2055)
  assert.ok(s.crossover && s.crossover.n > 220 && s.crossover.n < 240, `crossover at ${s.crossover?.n}`)
  close(s.totalInterest, PAYMENT * 360 - 400_000, 1)
  assert.equal(s.neverPaysOff, false)
})

test("the schedule matches what the simulation pays, year by year", () => {
  for (const d of [plan([mortgage()]), plan([heloc()], [home()]), plan([mortgage({ assetId: "h" })], [home({ end: { type: "year", year: 2036 } })])]) {
    const rows = simulatePlan(d).rows
    for (const debt of d.debts) {
      for (const y of loanSchedule(d, debt.id)!.years.filter((y) => !y.afterPlan)) {
        const row = rows[y.index]
        close(y.payment, row.debtPaymentsBy[debt.id] ?? 0)
        close(y.interest, row.debtInterestBy[debt.id] ?? 0)
        close(y.balance, row.debtBalances[debt.id] ?? 0)
      }
    }
  }
})

test("a sold home clears its loan from the sale; the schedule stops there", () => {
  const d = plan([mortgage({ assetId: "h" })], [home({ end: { type: "year", year: 2036 } })])
  const s = loanSchedule(d, "m")!
  assert.equal(s.years[s.years.length - 1].year, 2035)
  assert.equal(s.paidFromSale?.year, 2036)
  close(s.paidFromSale!.amount, s.years[s.years.length - 1].balance)
  assert.equal(s.payoffYear, null)
})

test("today's dollars: payments shrink with inflation; December matches the year-end balance", () => {
  const s = loanSchedule(plan([mortgage()]), "m")!
  const today = scheduleInBasis(s, "today", INFLATION)
  close(today.years[10].payment, s.years[10].payment / Math.pow(1 + INFLATION, 10))
  const y = today.years[3]
  close(y.months[11].balance, y.balance)
  assert.ok(today.totalPaid < s.totalPaid)
  assert.equal(scheduleInBasis(s, "future", INFLATION), s)
})

test("a payment below the interest never pays off", () => {
  const s = loanSchedule(plan([mortgage({ monthlyPayment: 1_000 })]), "m")!
  assert.equal(s.neverPaysOff, true)
  assert.equal(s.payoffYear, null)
})

test("HELOC: interest only through the draw period, then a level payment clears it", () => {
  const debt = heloc()
  close(scheduledPayment(debt, 0), 100_000 * 0.08 / 12)
  close(scheduledPayment(debt, 10), monthlyPayment(100_000, 0.08, 240))
  const s = loanSchedule(plan([debt], [home()]), "l")!
  assert.equal(s.drawEndsYear, 2037)
  for (const y of s.years.slice(0, 10)) close(y.balance, 100_000)
  assert.equal(s.years.length, 30)
  assert.equal(s.payoffYear, 2057)
  assert.ok(s.crossover && s.crossover.year > 2037)
})

test("HELOC: the draw arrives as cash in its year; one open at plan start brings none", () => {
  const d = plan([heloc()], [home()])
  const cash = d.accounts[0].id
  const rows = simulatePlan(d).rows
  assert.equal(rows[2].borrowed, 100_000)
  assert.equal(rows[1].borrowed, 0)
  close(rows[2].balances[cash] - rows[1].balances[cash], 100_000 - rows[2].debtPayments)
  const open = simulatePlan(plan([heloc({ start: { type: "planStart" } })], [home()])).rows
  assert.equal(open[0].borrowed, 0)
})

test("HELOC on a home bought the same year doesn't shrink the purchase's cost", () => {
  const bought = home({ start: { type: "year", year: 2028 } })
  const rows = simulatePlan(plan([heloc()], [bought])).rows
  close(rows[2].assetPurchases, 600_000 * Math.pow(1 + INFLATION, 2))
  assert.equal(rows[2].borrowed, 100_000)
})

test("a loan taken mid-plan brings its cash that year; one running at plan start brings none", () => {
  const loan = (extra: Partial<PlanDebt> = {}) => mortgage({ id: "p", kind: "other", balance: 50_000, monthlyPayment: monthlyPayment(50_000, 0.065, 60), start: { type: "year", year: 2029 }, ...extra })
  const d = plan([loan()])
  const cash = d.accounts[0].id
  const rows = simulatePlan(d).rows
  assert.equal(rows[3].borrowed, 50_000)
  assert.equal(rows[2].borrowed, 0)
  close(rows[3].balances[cash] - rows[2].balances[cash], 50_000 - rows[3].debtPayments)
  assert.equal(simulatePlan(plan([loan({ start: { type: "planStart" } })])).rows[0].borrowed, 0)
})

test("a loan against a home already owned brings its cash", () => {
  const rows = simulatePlan(plan([mortgage({ id: "p", balance: 100_000, assetId: "h", start: { type: "year", year: 2029 } })], [home()])).rows
  assert.equal(rows[3].borrowed, 100_000)
})

test("a loan financing a purchase the same year lowers its cost instead of bringing cash", () => {
  const bought = home({ start: { type: "year", year: 2028 } })
  const rows = simulatePlan(plan([mortgage({ assetId: "h", start: { type: "year", year: 2028 } })], [bought])).rows
  assert.equal(rows[2].borrowed, 0)
  close(rows[2].assetPurchases, 600_000 * Math.pow(1 + INFLATION, 2) - 400_000)
  const received = home({ start: { type: "year", year: 2028 }, acquired: "received" })
  assert.equal(simulatePlan(plan([mortgage({ assetId: "h", start: { type: "year", year: 2028 } })], [received])).rows[2].borrowed, 0)
})

test("HELOC: paid off from the sale when the home is sold", () => {
  const rows = simulatePlan(plan([heloc()], [home({ end: { type: "year", year: 2032 } })])).rows
  assert.equal(rows[6].debtBalances.l, 0)
})

test("HELOC interest is itemized only when it was spent on the home", () => {
  const taxed = (forHome: boolean) => {
    const base = plan([heloc({ balance: 600_000, start: { type: "planStart" }, heloc: { ...HELOC_DEFAULTS, forHome } })], [home({ value: 1_000_000 })], {
      taxMode: "brackets", state: "NJ", filingStatus: "single", inflation: 0,
    })
    const d: PlanDocument = {
      ...base,
      incomes: [{ id: "w", name: "Salary", kind: "salary", amount: 300_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }],
    }
    return simulatePlan(d).rows[0]
  }
  assert.equal(taxed(false).deduction?.itemized, false)
  assert.equal(taxed(true).deduction?.itemized, true)
  assert.ok(taxed(true).incomeTax < taxed(false).incomeTax)
})

test("old plans without HELOC terms still parse; a HELOC's terms round-trip", () => {
  const old = plan([mortgage()])
  assert.ok(planDocumentSchema.safeParse(old).success)
  const parsed = planDocumentSchema.safeParse(plan([heloc()], [home()]))
  assert.ok(parsed.success)
  assert.deepEqual(parsed.data.debts[0].heloc, HELOC_DEFAULTS)
})

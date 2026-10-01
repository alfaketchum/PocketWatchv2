import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { amortizeYear } from "@/lib/plans/engine/engine-assets"
import { blankPlanDocument, PRIMARY_PERSON_ID, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { rowInTodaysDollars } from "@/lib/plans/plan-dollars"
import { summarizePlan } from "@/lib/plans/plan-summary"
import { planLength, resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import { planDocumentSchema, parsePlanDocument } from "@/lib/plans/plan-schema"
import { projectPath } from "@/lib/fire/fire-projection"
import type { PlanAccount, PlanDocument, PlanExpense, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)

function assertClose(actual: number, expected: number, tolerance = 0.01, message?: string) {
  assert.ok(Math.abs(actual - expected) < tolerance, message ?? `Expected ${actual} ≈ ${expected}`)
}

function account(id: string, taxTreatment: PlanAccount["taxTreatment"], balance: number, returnRate = 0): PlanAccount {
  return { id, name: id, taxTreatment, balance, costBasis: null, returnRate, owner: null, source: null }
}

function income(amount: number, extra: Partial<PlanIncome> = {}): PlanIncome {
  return {
    id: "inc",
    name: "Salary",
    kind: "salary",
    amount,
    growth: 0,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    taxable: false,
    oneTime: false,
    contributions: [],
    ...extra,
  }
}

function expense(amount: number, extra: Partial<PlanExpense> = {}): PlanExpense {
  return {
    id: "exp",
    name: "Living",
    category: null,
    amount,
    growth: 0,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    oneTime: false,
    ...extra,
  }
}

/** Zero inflation/taxes, no cash buffer, person aged 35, plan runs 10 years. */
function doc(patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [],
    ...patch,
  }
}

test("blank plan validates against the schema", () => {
  assert.ok(planDocumentSchema.safeParse(blankPlanDocument(NOW)).success)
})

test("parsePlanDocument fills missing sections and rejects bad documents", () => {
  const base = blankPlanDocument(NOW)
  const { milestones: _m, ...partial } = base
  assert.deepEqual(parsePlanDocument(partial, base)?.milestones, base.milestones)
  assert.equal(parsePlanDocument({ ...base, accounts: [{ id: "x" }] }, base), null)
})

test("plan length runs to endAge", () => {
  assert.equal(planLength(doc()), 10)
})

test("timing resolves plan bounds, years, ages and milestones", () => {
  const d = doc()
  const ctx = timingContext(d)
  assert.equal(resolveTiming({ type: "planStart" }, ctx), 0)
  assert.equal(resolveTiming({ type: "planEnd" }, ctx), 10)
  assert.equal(resolveTiming({ type: "year", year: 2030 }, ctx), 4)
  assert.equal(resolveTiming({ type: "age", personId: PRIMARY_PERSON_ID, age: 40 }, ctx), 5)
  assert.equal(resolveTiming({ type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID }, ctx), 30)
  assert.equal(resolveTiming({ type: "milestone", milestoneId: "missing" }, ctx), null)
})

test("milestone cycles resolve to null instead of looping", () => {
  const d = doc({
    milestones: [
      { id: "a", name: "A", kind: "custom", timing: { type: "milestone", milestoneId: "b" } },
      { id: "b", name: "B", kind: "custom", timing: { type: "milestone", milestoneId: "a" } },
    ],
  })
  assert.equal(resolveTiming({ type: "milestone", milestoneId: "a" }, timingContext(d)), null)
})

test("single account with constant savings matches FIRE projectPath", () => {
  const d = doc({ accounts: [account("brk", "taxable", 100_000, 0.05)], incomes: [income(30_000)] })
  const rows = simulatePlan(d).rows
  const path = projectPath(100_000, 30_000, 0.05, 35, 10, 2026)
  rows.forEach((row, i) => assertClose(row.accountsTotal, path[i + 1].value, 0.01, `year ${i}`))
})

test("surplus fills the cash buffer, then capped targets, then overflow", () => {
  const d = doc({
    settings: { ...doc().settings, cashBuffer: 5_000 },
    accounts: [account("cash", "cash", 0), account("roth", "roth", 0), account("brk", "taxable", 0)],
    incomes: [income(20_000)],
    cashFlow: { surplusOrder: [{ accountId: "roth", annualCap: 7_000 }], withdrawalOrder: [] },
  })
  const first = simulatePlan(d).rows[0]
  assert.equal(first.balances.cash, 5_000)
  assert.equal(first.balances.roth, 7_000)
  assert.equal(first.balances.brk, 8_000)
})

test("deficits follow the withdrawal order and gross up traditional withdrawals", () => {
  const d = doc({
    settings: { ...doc().settings, incomeTaxRate: 0.25 },
    accounts: [account("trad", "traditional", 100_000), account("roth", "roth", 100_000)],
    expenses: [expense(30_000)],
    cashFlow: { surplusOrder: [], withdrawalOrder: ["trad", "roth"] },
  })
  const first = simulatePlan(d).rows[0]
  assertClose(first.withdrawalsBy.trad, 40_000)
  assertClose(first.withdrawalTax, 10_000)
  assert.equal(first.balances.roth, 100_000)
})

test("taxable withdrawals pay capital gains on the gains share and shrink basis", () => {
  const brk: PlanAccount = { ...account("brk", "taxable", 100_000), costBasis: 50_000 }
  const d = doc({
    settings: { ...doc().settings, capitalGainsRate: 0.2 },
    accounts: [brk],
    expenses: [expense(9_000)],
  })
  const rows = simulatePlan(d).rows
  // Gains share 50% × 20% = 10% tax → gross 10,000 for 9,000 net.
  assertClose(rows[0].withdrawalsBy.brk, 10_000)
  assertClose(rows[0].balances.brk, 90_000)
  // Basis shrinks proportionally, so the gains share (and tax rate) stays 50% × 20%.
  assertClose(rows[1].withdrawalsBy.brk, 10_000)
})

test("pre-tax payroll contributions lower income tax and employer match is added", () => {
  const d = doc({
    settings: { ...doc().settings, incomeTaxRate: 0.2 },
    accounts: [account("k401", "traditional", 0), account("cash", "cash", 0)],
    incomes: [
      income(100_000, {
        taxable: true,
        contributions: [{ id: "c", accountId: "k401", percent: 0.1, employerMatchPercent: 0.05, preTax: true }],
      }),
    ],
  })
  const first = simulatePlan(d).rows[0]
  assertClose(first.incomeTax, 18_000)
  // Payroll tax is on the full 100k: pre-tax 401(k) contributions don't lower it.
  assertClose(first.payrollTax, 7_650)
  assertClose(first.balances.k401, 15_000)
  assertClose(first.balances.cash, 100_000 - 10_000 - 18_000 - 7_650)
})

test("running out of money sets a shortfall and the depleted age", () => {
  const d = doc({ accounts: [account("cash", "cash", 50_000)], expenses: [expense(20_000)] })
  const projection = simulatePlan(d)
  assert.equal(projection.rows[2].shortfall, 10_000)
  const summary = summarizePlan(d, projection)
  assert.equal(summary.depletedAge, 37)
  assert.equal(summary.depletedYear, 2028)
})

test("income stops at the retirement milestone and expenses can start there", () => {
  const retireAt40 = doc().milestones.map((m) => ({
    ...m,
    timing: { type: "age" as const, personId: PRIMARY_PERSON_ID, age: 40 },
  }))
  const d = doc({
    milestones: retireAt40,
    accounts: [account("cash", "cash", 0)],
    incomes: [income(10_000, { end: { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID } })],
    expenses: [expense(1_000, { start: { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID } })],
  })
  const rows = simulatePlan(d).rows
  assert.equal(rows[4].income, 10_000)
  assert.equal(rows[5].income, 0)
  assert.equal(rows[4].expenses, 0)
  assert.equal(rows[5].expenses, 1_000)
  assert.deepEqual(rows[5].milestones, ["Retirement"])
  assert.equal(summarizePlan(d, simulatePlan(d)).netWorthAtRetirement, 50_000)
})

test("one-time items only happen in their start year", () => {
  const d = doc({
    accounts: [account("cash", "cash", 0)],
    incomes: [income(5_000, { oneTime: true, start: { type: "year", year: 2028 } })],
  })
  const rows = simulatePlan(d).rows
  assert.deepEqual(rows.map((r) => r.income).slice(0, 4), [0, 0, 5_000, 0])
})

test("amortizeYear: payments stop at payoff", () => {
  const year = amortizeYear(1_000, 0, 300)
  assert.equal(year.balance, 0)
  assert.equal(year.paid, 1_000)
})

test("amortizeYear: interest is the part of each payment that isn't principal", () => {
  const year = amortizeYear(12_000, 0.12, 1_000)
  // First month: 1% of 12,000 = 120 interest, 880 principal.
  assert.ok(year.interest > 120 && year.interest < 12 * 120)
  assert.ok(Math.abs(year.paid - year.interest - (12_000 - year.balance)) < 1e-6, "principal paid = balance reduction")
  assert.equal(amortizeYear(1_000, 0, 300).interest, 0)
})

test("mortgage pays off and its payment stops; selling a home repays its debt", () => {
  const d = doc({
    accounts: [account("cash", "cash", 1_000_000)],
    assets: [
      {
        id: "home",
        name: "Home",
        kind: "home",
        value: 300_000,
        appreciation: 0,
        start: { type: "planStart" },
        end: { type: "year", year: 2031 },
      },
    ],
    debts: [
      {
        id: "mtg",
        name: "Mortgage",
        kind: "mortgage",
        balance: 24_000,
        rate: 0,
        monthlyPayment: 1_000,
        start: { type: "planStart" },
        assetId: "home",
        source: null,
      },
    ],
  })
  const rows = simulatePlan(d).rows
  assert.equal(rows[0].debtPayments, 12_000)
  assert.equal(rows[1].debtPayments, 12_000)
  assert.equal(rows[2].debtPayments, 0)
  assert.equal(rows[4].assetsTotal, 300_000)
  assert.equal(rows[5].assetSales, 300_000)
  assert.equal(rows[5].assetsTotal, 0)
})

test("buying a home later pays the down payment from cash flow", () => {
  const d = doc({
    accounts: [account("cash", "cash", 200_000)],
    assets: [
      {
        id: "home",
        name: "Home",
        kind: "home",
        value: 250_000,
        appreciation: 0,
        start: { type: "year", year: 2028 },
        end: { type: "planEnd" },
      },
    ],
    debts: [
      {
        id: "mtg",
        name: "Mortgage",
        kind: "mortgage",
        balance: 200_000,
        rate: 0,
        monthlyPayment: 0,
        start: { type: "year", year: 2028 },
        assetId: "home",
        source: null,
      },
    ],
  })
  const rows = simulatePlan(d).rows
  assert.equal(rows[1].debtsTotal, 0)
  assert.equal(rows[2].assetPurchases, 50_000)
  assert.equal(rows[2].balances.cash, 150_000)
  assert.equal(rows[2].netWorth, 200_000)
})

test("today's dollars deflates flows by year and balances by year end", () => {
  const d = doc({
    settings: { ...doc().settings, inflation: 0.03 },
    accounts: [account("cash", "cash", 0)],
    incomes: [income(10_000, { growth: null })],
  })
  const rows = simulatePlan(d).rows
  const real = rowInTodaysDollars(rows[3], 0.03)
  assertClose(real.income, 10_000)
  assertClose(real.balances.cash, rows[3].balances.cash / Math.pow(1.03, 4))
})

test("protected buffer: shortfalls come from other accounts first; the buffer is spent last", () => {
  const d = doc({
    settings: { ...doc().settings, cashBuffer: 10_000, protectBuffer: true },
    accounts: [account("cash", "cash", 15_000), account("brk", "taxable", 20_000)],
    expenses: [expense(12_000)],
  })
  const rows = simulatePlan(d).rows
  // Year 1: 5k above the buffer, then 7k from the brokerage.
  assert.equal(rows[0].balances.cash, 10_000)
  assert.equal(rows[0].balances.brk, 13_000)
  // Year 2: all 12k from the brokerage. Year 3: its last 1k, then the 10k buffer, still 1k short.
  assert.equal(rows[1].balances.cash, 10_000)
  assert.equal(rows[2].balances.cash, 0)
  assert.equal(rows[2].shortfall, 1_000)
})

test("unprotected buffer is spent first (cash leads the default withdrawal order)", () => {
  const d = doc({
    settings: { ...doc().settings, cashBuffer: 10_000, protectBuffer: false },
    accounts: [account("cash", "cash", 15_000), account("brk", "taxable", 20_000)],
    expenses: [expense(12_000)],
  })
  const first = simulatePlan(d).rows[0]
  assert.equal(first.balances.cash, 3_000)
  assert.equal(first.balances.brk, 20_000)
})

test("the chosen buffer account is the one refilled from surplus", () => {
  const d = doc({
    settings: { ...doc().settings, cashBuffer: 5_000, bufferAccountId: "savings" },
    accounts: [account("checking", "cash", 0), account("savings", "cash", 0), account("brk", "taxable", 0)],
    incomes: [income(8_000)],
  })
  const first = simulatePlan(d).rows[0]
  assert.equal(first.balances.savings, 5_000)
  assert.equal(first.balances.checking, 0)
  assert.equal(first.balances.brk, 3_000)
})

test("plans saved before the buffer settings existed still load, with protection on", () => {
  const base = blankPlanDocument(NOW)
  const { bufferAccountId: _a, protectBuffer: _p, ...oldSettings } = base.settings
  const parsed = parsePlanDocument({ ...base, settings: oldSettings }, base)
  assert.equal(parsed?.settings.protectBuffer, true)
  assert.equal(parsed?.settings.bufferAccountId, null)
})

import test from "node:test"
import assert from "node:assert/strict"
import { minimumTax, federalTax, taxBase, type TaxSituation } from "@/lib/plans/tax/tax-calc"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import type { PlanAccount, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)
const SINGLE: TaxSituation = { status: "single", state: null, index: 1 }

function close(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `Expected ${actual} ≈ ${expected}`)
}

/** 2026 single regular tax on $150k wages: 133,900 taxable. */
const REGULAR_150K = 1_240 + 4_560 + 12_166 + 6_768

test("no AMT on an ordinary salary", () => {
  const m = minimumTax(taxBase({ ordinary: 150_000 }), SINGLE, 0)
  assert.equal(m.amt, 0)
  assert.equal(m.creditEarned, 0)
})

test("kept ISO gains trigger AMT at 26% / 28% after the exemption, all of it creditable", () => {
  const base = taxBase({ ordinary: 150_000, amtPreference: 200_000 })
  const m = minimumTax(base, SINGLE, 0)
  // AMT income 350,000 − 90,100 exemption = 259,900: 26% to 244,500, 28% above.
  const tentative = 0.26 * 244_500 + 0.28 * (259_900 - 244_500)
  close(m.amt, tentative - REGULAR_150K)
  close(m.creditEarned, m.amt)
  close(federalTax(base, SINGLE), tentative)
})

test("the exemption phases out at 50% over $500,000", () => {
  const m = minimumTax(taxBase({ ordinary: 100_000, amtPreference: 500_000 }), SINGLE, 0)
  const exemption = 90_100 - 0.5 * 100_000
  const taxable = 600_000 - exemption
  const regular = 1_240 + 4_560 + (83_900 - 50_400) * 0.22
  close(m.amt, 0.26 * 244_500 + 0.28 * (taxable - 244_500) - regular)
})

test("long-term gains keep their own rates under the AMT", () => {
  const m = minimumTax(taxBase({ ordinary: 50_000, longGains: 100_000, amtPreference: 100_000 }), SINGLE, 0)
  // AMT income 250,000 − 90,100 = 159,900: 59,900 ordinary at 26%, then 100,000 of gains at 15% (all above the 0% line).
  const tentative = 0.26 * 59_900 + 0.15 * 100_000
  // Regular: 33,900 ordinary taxable, then gains stacked: 15,550 at 0%, the rest at 15%.
  const regular = 1_240 + (33_900 - 12_400) * 0.12 + 0.15 * (100_000 - (49_450 - 33_900))
  close(m.amt, tentative - regular)
})

test("a credit from earlier AMT comes off regular tax only down to the tentative minimum tax", () => {
  const base = taxBase({ ordinary: 150_000 })
  const tentative = 0.26 * (150_000 - 90_100)
  const used = minimumTax(base, { ...SINGLE, amtCredit: 50_000 }, 0).creditUsed
  close(used, REGULAR_150K - tentative)
  close(minimumTax(base, { ...SINGLE, amtCredit: 1_000 }, 0).creditUsed, 1_000)
  close(federalTax(base, { ...SINGLE, amtCredit: 50_000 }), tentative)
})

function account(id: string, taxTreatment: PlanAccount["taxTreatment"]): PlanAccount {
  return { id, name: id, taxTreatment, balance: 0, costBasis: null, returnRate: 0, owner: null, source: null }
}

function plan(incomes: PlanIncome[]): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, filingStatus: "single", inflation: 0, cashBuffer: 0, endAge: 45 },
    accounts: [account("cash", "cash"), account("stock", "taxable")],
    cashFlow: { surplusOrder: [{ accountId: "cash", annualCap: null }], withdrawalOrder: ["cash", "stock"] },
    incomes,
  }
}

const salary: PlanIncome = {
  id: "pay",
  name: "Salary",
  kind: "salary",
  amount: 150_000,
  growth: 0,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  taxable: true,
  oneTime: false,
  contributions: [],
}

function iso(kept: number): PlanIncome {
  return {
    id: "iso",
    name: "ISOs",
    kind: "equity",
    amount: 200_000,
    growth: 0,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    taxable: true,
    oneTime: true,
    contributions: kept > 0 ? [{ id: "k", accountId: "stock", percent: kept, employerMatchPercent: 0, preTax: false }] : [],
    equity: { symbol: null, shares: 10_000, price: 30, strike: 10, volatility: 0, iso: true },
  }
}

test("ISOs kept: no regular tax or payroll tax at exercise, AMT instead, shares at zero basis", () => {
  const rows = simulatePlan(plan([salary, iso(1)])).rows
  const base = simulatePlan(plan([salary])).rows
  close(rows[0].payrollTax, base[0].payrollTax)
  close(rows[0].incomeTax - base[0].incomeTax, 0.26 * 244_500 + 0.28 * (259_900 - 244_500) - REGULAR_150K, 1)
  close(rows[0].balances.stock, 200_000)
})

test("the AMT on ISOs comes back as a credit in later years", () => {
  const rows = simulatePlan(plan([salary, iso(1)])).rows
  const base = simulatePlan(plan([salary])).rows
  const amt = rows[0].incomeTax - base[0].incomeTax
  const yearly = REGULAR_150K - 0.26 * (150_000 - 90_100)
  // Each later year, regular tax drops to the tentative minimum tax until the credit is used up.
  close(base[1].incomeTax - rows[1].incomeTax, yearly, 1)
  const recovered = rows.slice(1).reduce((s, r, i) => s + (base[i + 1].incomeTax - r.incomeTax), 0)
  close(recovered, Math.min(amt, yearly * (rows.length - 1)), 2)
})

test("ISOs sold at exercise are ordinary income without payroll tax or AMT", () => {
  const rows = simulatePlan(plan([salary, iso(0)])).rows
  const base = simulatePlan(plan([salary])).rows
  close(rows[0].payrollTax, base[0].payrollTax)
  // 200,000 more ordinary income from 133,900 taxable: 24% to 201,775, 32% to 256,225, 35% above.
  close(rows[0].incomeTax - base[0].incomeTax, (201_775 - 133_900) * 0.24 + (256_225 - 201_775) * 0.32 + (333_900 - 256_225) * 0.35)
  close(rows[1].incomeTax, base[1].incomeTax)
})

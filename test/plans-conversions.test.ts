import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { summarizePlan } from "@/lib/plans/plan-summary"
import { planDocumentSchema, parsePlanDocument } from "@/lib/plans/plan-schema"
import { removeAccount } from "@/lib/plans/plan-edits"
import { blankConversion, conversionWarnings } from "@/lib/plans/plan-conversions"
import type { PlanAccount, PlanConversion, PlanDocument, PlanSettings, TaxTreatment } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`)

const account = (id: string, taxTreatment: TaxTreatment, balance: number, extra: Partial<PlanAccount> = {}): PlanAccount => ({
  id, name: id, taxTreatment, balance, costBasis: null, returnRate: 0, owner: null, source: null, ...extra,
})

const ACCOUNTS = [account("cash", "cash", 300_000), account("ira", "traditional", 1_000_000), account("roth", "roth", 0)]

/** Someone `age` (born January) from 2026 under 2026 brackets, no state tax, no inflation or returns, spending from cash. */
function plan(age: number, conversions: PlanConversion[], settings: Partial<PlanSettings> = {}, patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), age)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, filingStatus: "single", inflation: 0, cashBuffer: 0, protectBuffer: false, endAge: age + 8, ...settings },
    accounts: ACCOUNTS,
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: null, amount: 20_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    cashFlow: { surplusOrder: [], withdrawalOrder: ["cash"] },
    milestones: [],
    conversions,
    ...patch,
  }
}

function rule(extra: Partial<PlanConversion> & Pick<PlanConversion, "mode">): PlanConversion {
  return {
    id: "conv", name: "Convert", start: { type: "planStart" }, end: { type: "planEnd" },
    sourceAccountIds: ["ira"], destAccountId: "roth", caps: {}, payTaxFrom: "cashFlow",
    ...(extra.mode === "bracket" ? { bracketRate: 0.22 } : extra.mode === "fixed" ? { amount: 50_000, amountBasis: "today" } : extra.mode === "targetIncome" ? { targetIncome: 80_000 } : {}),
    ...extra,
  } as PlanConversion
}

const rows = (d: PlanDocument) => simulatePlan(d).rows
/** Federal taxable ordinary income on the row: everything ordinary less the deduction taken. */
const taxableOrdinary = (r: ReturnType<typeof rows>[number]) => r.taxableIncome - (r.deduction?.amount ?? 0) - (r.deduction?.senior ?? 0)

test("no rules and an empty list simulate the same", () => {
  const d = plan(60, [])
  const { conversions: _, ...without } = d
  assert.deepEqual(rows(d), rows(without as PlanDocument))
  assert.equal(rows(d)[0].conversions, 0)
})

test("fixed: today's dollars grow with inflation; the Roth gets it all when tax comes from cash flow", () => {
  const r = rows(plan(60, [rule({ mode: "fixed" })], { inflation: 0.03 }))
  close(r[0].conversions, 50_000, 0.01)
  close(r[2].conversions, 50_000 * 1.03 ** 2, 0.01)
  close(r[0].conversionsInto.roth, 50_000, 0.01)
  close(r[0].balances.roth, 50_000, 0.01)
  assert.ok(r[0].conversionTax > 0)
  assert.equal(r[0].withdrawalsBy.ira, undefined)
})

test("bracket: fills taxable ordinary income to the top of the 22% bracket", () => {
  const r = rows(plan(60, [rule({ mode: "bracket", bracketRate: 0.22 })]))
  close(taxableOrdinary(r[0]), 105_700)
  close(r[0].conversions, 105_700 + 16_100)
})

test("targetIncome: fills total taxable income to the target (today's dollars)", () => {
  const r = rows(plan(60, [rule({ mode: "targetIncome", targetIncome: 80_000 })]))
  close(taxableOrdinary(r[0]), 80_000)
})

test("convertAll empties the sources by the end", () => {
  const d = plan(60, [rule({ mode: "convertAll", end: { type: "age", personId: "person-1", age: 64 } })])
  const r = rows(d)
  close(r[0].conversions, 250_000, 1)
  close(r[3].balances.ira, 0, 1)
  assert.equal(r[4].conversions, 0)
})

test("the IRMAA cap holds MAGI under the first line from 63; before 63 it doesn't apply", () => {
  const capped = rule({ mode: "bracket", bracketRate: 0.24, caps: { irmaaTier: 0 } })
  const at63 = rows(plan(63, [capped]))[0]
  assert.ok(at63.taxableIncome < 109_000 && at63.taxableIncome > 108_000, String(at63.taxableIncome))
  const at60 = rows(plan(60, [capped]))[0]
  close(taxableOrdinary(at60), 201_775)
})

test("the 0% gains guard stops before long-term gains leave the 0% bracket", () => {
  const brokerage = account("brokerage", "taxable", 100_000, { costBasis: 0 })
  const d = plan(60, [rule({ mode: "bracket", bracketRate: 0.22, caps: { keepLtcgZero: true } })], {}, {
    accounts: [account("cash", "cash", 0), brokerage, ...ACCOUNTS.slice(1)],
    cashFlow: { surplusOrder: [], withdrawalOrder: ["brokerage"] },
  })
  const r = rows(d)[0]
  assert.equal(r.longGainsTax < 1, true, `gains tax ${r.longGainsTax}`)
  assert.ok(r.conversions > 0)
})

test("converting lowers later required withdrawals", () => {
  const without = plan(72, [], { endAge: 76 })
  const withRule = plan(72, [rule({ mode: "fixed", amount: 100_000, end: { type: "age", personId: "person-1", age: 73 } })], { endAge: 76 })
  assert.ok(rows(withRule)[2].requiredWithdrawals < rows(without)[2].requiredWithdrawals - 1000)
})

test("required withdrawals come first and count toward the bracket", () => {
  const r = rows(plan(74, [rule({ mode: "bracket", bracketRate: 0.22 })], { endAge: 78 }))[0]
  assert.ok(r.requiredWithdrawals > 0)
  close(taxableOrdinary(r), 105_700)
})

test("two sources are drawn pro rata to their balances", () => {
  const d = plan(60, [rule({ mode: "fixed", amount: 30_000, sourceAccountIds: ["ira", "k401"] })], {}, {
    accounts: [...ACCOUNTS, account("k401", "traditional", 500_000)],
  })
  const r = rows(d)[0]
  close(r.conversionsBy.ira, 20_000, 0.01)
  close(r.conversionsBy.k401, 10_000, 0.01)
})

test("withholding: less reaches the Roth, and the withheld part is penalized before 59½", () => {
  const at55 = rows(plan(55, [rule({ mode: "fixed", amount: 50_000, payTaxFrom: "withhold" })]))[0]
  assert.ok(at55.conversionsInto.roth < 50_000 - 1000)
  close(at55.earlyWithdrawalPenalty, (50_000 - at55.conversionsInto.roth) * 0.1, 1)
  const at62 = rows(plan(62, [rule({ mode: "fixed", amount: 50_000, payTaxFrom: "withhold" })]))[0]
  assert.equal(at62.earlyWithdrawalPenalty, 0)
})

test("flat tax mode: bracket rules convert nothing; fixed ones still work", () => {
  assert.equal(rows(plan(60, [rule({ mode: "bracket" })], { taxMode: "flat" }))[0].conversions, 0)
  close(rows(plan(60, [rule({ mode: "fixed" })], { taxMode: "flat" }))[0].conversions, 50_000, 0.01)
})

test("tax kinds still add up and the true-up settles", () => {
  for (const r of rows(plan(60, [rule({ mode: "bracket", bracketRate: 0.24 })]))) {
    const paid = r.incomeTax + r.withdrawalTax + r.saleTax + r.tradingTax
    close(r.ordinaryIncomeTax + r.shortGainsTax + r.longGainsTax, paid, 1)
  }
})

test("the 5-year rule: converted money spent within 5 years before 59½ pays 10%; after 59½ it doesn't", () => {
  // Convert everything in the first year; spending then has to come out of the Roth.
  const young = (age: number) =>
    plan(age, [rule({ mode: "convertAll", end: { type: "age", personId: "person-1", age: age + 1 } })], {}, {
      accounts: [account("cash", "cash", 40_000), account("ira", "traditional", 100_000), account("roth", "roth", 0)],
    })
  const early = rows(young(50))
  assert.ok(early[2].withdrawalsBy.roth > 0)
  assert.ok(early[2].earlyWithdrawalPenalty > 0)
  const late = rows(young(60))
  assert.ok(late[2].withdrawalsBy.roth > 0)
  assert.equal(late[2].earlyWithdrawalPenalty, 0)
})

test("after-tax ending net worth takes the heirs' rate off traditional balances", () => {
  const d = plan(60, [], { heirsTaxRate: 0.3 })
  const s = summarizePlan(d, simulatePlan(d))
  const last = simulatePlan(d).rows.at(-1)!
  close(s.afterTaxEndingNetWorth, s.endingNetWorth - last.balances.ira * 0.3, 1)
})

test("schema: rules validate; old plans without them still parse", () => {
  const d = plan(60, [rule({ mode: "bracket" }), rule({ id: "c2", mode: "fixed" }), rule({ id: "c3", mode: "convertAll" })])
  assert.equal(planDocumentSchema.safeParse(d).success, true)
  const { conversions: _, ...old } = d
  assert.deepEqual(parsePlanDocument(old, blankPlanDocument(new Date(2026, 0, 15)))?.conversions, [])
  assert.equal(planDocumentSchema.safeParse({ ...d, conversions: [{ ...rule({ mode: "bracket" }), bracketRate: 0.5 }] }).success, false)
})

test("removing an account cleans up the rules that used it", () => {
  const d = plan(60, [rule({ mode: "bracket" })])
  assert.deepEqual(removeAccount(d, "roth").conversions, [])
  assert.deepEqual(removeAccount(d, "ira").conversions, [])
})

test("blankConversion picks the person's traditional accounts and Roth; warnings catch flat tax", () => {
  const d = plan(60, [])
  const c = blankConversion(d, "new")
  assert.ok(c)
  assert.deepEqual(c.sourceAccountIds, ["ira"])
  assert.equal(c.destAccountId, "roth")
  assert.deepEqual(conversionWarnings(d, c), [])
  assert.equal(conversionWarnings({ ...d, settings: { ...d.settings, taxMode: "flat" } }, c).length, 1)
})

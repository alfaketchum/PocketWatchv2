import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { applyWhatIf } from "@/lib/plans/plan-what-if"
import type { PlanAccount, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"
import { claimFactor, yearlyBenefit } from "@/lib/plans/social-security"
import {
  claimSocialSecurityAt,
  everydaySpending,
  investmentLadder,
  portfolioMix,
  retireAt,
  sellHomesIfNeeded,
  retirementAge,
  scaleEverydaySpending,
  socialSecurityOf,
  withInvestmentMix,
} from "@/lib/plans/stress/stress-levers"

const NOW = new Date(2026, 0, 15)

const account = (id: string, extra: Partial<PlanAccount>): PlanAccount => ({
  id,
  name: id,
  taxTreatment: "taxable",
  balance: 100_000,
  costBasis: null,
  returnRate: 0.06,
  owner: null,
  source: null,
  ...extra,
})

function plan(extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 40)
  return {
    ...base,
    incomes: [],
    expenses: [
      { id: "living", name: "Living", category: "Living", amount: 60_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false },
      { id: "trip", name: "Trip", category: null, amount: 10_000, growth: null, start: { type: "planStart" }, end: { type: "planStart" }, oneTime: true },
      { id: "tax", name: "Generated", category: null, amount: 5_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false, origin: "ms-x" },
    ],
    accounts: [account("cash", { taxTreatment: "cash", balance: 20_000 }), account("crypto", { balance: 600_000, source: { kind: "crypto", refId: "c" } }), account("stocks", { balance: 200_000 }), account("529", { taxTreatment: "education", balance: 50_000 })],
    assets: [],
    debts: [],
    ...extra,
  }
}

test("everyday spending: only recurring costs you entered are scaled", () => {
  const doc = plan()
  assert.equal(everydaySpending(doc), 60_000)
  assert.deepEqual(scaleEverydaySpending(doc, 0.8).expenses.map((e) => e.amount), [48_000, 10_000, 5_000])
})

test("the portfolio mix is balance-weighted over invested accounts only", () => {
  const mix = portfolioMix(plan())!
  assert.ok(Math.abs(mix.crypto - 0.75) < 1e-9, "$600k crypto of $800k invested")
  assert.ok(Math.abs(mix.stocks - 0.2) < 1e-9 && Math.abs(mix.bonds - 0.05) < 1e-9)
})

test("a new mix goes to every invested account; cash and 529s are left alone", () => {
  const doc = plan()
  const next = withInvestmentMix(doc, { stocks: 0.6, bonds: 0.4, cash: 0, crypto: 0 })
  assert.deepEqual(next.accounts.map((a) => a.mix ?? null), [null, { stocks: 0.6, bonds: 0.4, cash: 0, crypto: 0 }, { stocks: 0.6, bonds: 0.4, cash: 0, crypto: 0 }, null])
  assert.equal(next.accounts[1].returnRate, doc.accounts[1].returnRate, "assumed returns don't change")
})

test("the ladder halves crypto first, then the standard mixes, skipping today's", () => {
  assert.deepEqual(investmentLadder(plan()).map((r) => r.key), ["crypto-half", "mix-100", "mix-80", "mix-60", "mix-40"])
  const half = investmentLadder(plan())[0].mix
  assert.ok(Math.abs(half.crypto - 0.375) < 1e-9)
  const eighty = plan({ accounts: [account("a", {})] })
  assert.deepEqual(investmentLadder(eighty).map((r) => r.key), ["mix-100", "mix-60", "mix-40"], "an 80/20 plan doesn't try 80/20 again")
})

test("retiring at an age moves the retirement milestone", () => {
  const doc = plan()
  const age = retirementAge(doc)!
  const later = retireAt(doc, age + 3)
  assert.equal(retirementAge(later), age + 3)
  assert.equal(later.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID)!.timing.type, "age")
})

const ss = (person: string, extra: Partial<PlanIncome>): PlanIncome => ({
  id: "ss",
  name: "Social Security",
  kind: "social_security",
  amount: 20_000,
  growth: null,
  start: { type: "age", personId: person, age: 62 },
  end: { type: "planEnd" },
  taxable: true,
  oneTime: false,
  contributions: [],
  ...extra,
})

test("claiming Social Security later moves its start, claim age and benefit together", () => {
  const base = plan()
  const person = base.people[0]
  const doc = plan({ incomes: [ss(person.id, { socialSecurity: { pia: 2_000, claimAge: 62 } })] })
  const at70 = claimSocialSecurityAt(doc, 70).incomes[0]
  assert.deepEqual(at70.start, { type: "age", personId: person.id, age: 70 })
  assert.equal(at70.socialSecurity!.claimAge, 70)
  assert.equal(at70.amount, Math.round(yearlyBenefit(2_000, person.birthYear, 70)))
  assert.deepEqual(applyWhatIf(doc, { ssClaimAge: 70, events: [] }).incomes[0].start, at70.start, "What-if's dial moves the start too")
})

test("an amount entered by hand is rescaled by the claim factors", () => {
  const base = plan()
  const person = base.people[0]
  const doc = plan({ incomes: [ss(person.id, {})] })
  assert.equal(socialSecurityOf(doc)!.claimAge, 62)
  const at67 = claimSocialSecurityAt(doc, 67).incomes[0]
  assert.equal(at67.amount, Math.round((20_000 * claimFactor(person.birthYear, 67)) / claimFactor(person.birthYear, 62)))
  assert.equal(claimSocialSecurityAt(doc, 75).incomes[0].start.type === "age" && (claimSocialSecurityAt(doc, 75).incomes[0].start as { age: number }).age, 70, "clamped to 70")
})

test("everyday spending today counts only the lines running now, not later ones", () => {
  const doc = plan({
    expenses: [
      { id: "rent1", name: "Rent (shared)", category: "Housing", amount: 30_000, growth: null, start: { type: "planStart" }, end: { type: "year", year: 2030 }, oneTime: false },
      { id: "rent2", name: "Rent (1BR)", category: "Housing", amount: 54_000, growth: null, start: { type: "year", year: 2030 }, end: { type: "planEnd" }, oneTime: false },
      { id: "food", name: "Food", category: "Food", amount: 10_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false },
    ],
  })
  assert.equal(everydaySpending(doc), 40_000)
})

test("sell if the money runs out: rent after the home you live in, just sell a second home", () => {
  const home = (id: string, primaryResidence: boolean) => ({ id, name: id, kind: "home" as const, value: 500_000, appreciation: 0.03, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, runningCosts: [], primaryResidence, fallback: { then: "keep", monthlyRent: 0, price: 0 } })
  const doc = sellHomesIfNeeded(plan({ assets: [home("main", true), home("beach", false)] }))
  assert.equal(doc.assets[0].fallback?.then, "rent")
  assert.equal(doc.assets[1].fallback?.then, "sell")
})

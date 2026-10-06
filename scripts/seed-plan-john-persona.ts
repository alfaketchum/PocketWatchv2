/**
 * Seeds a plan with a fake persona: John, 21, a first-year investment-banking analyst in NYC with $45k of
 * undergrad loans. Associate at 24, a two-year MBA at 27 (paid with $150k of loans), VP at 29, marries Claire at
 * 31, kids in 2038 and 2041 (private college, 529s), moves to Morristown NJ at 33 and buys a $1.6M house, and
 * buys a $900k Jersey Shore beach house at 38. The things that typically break banker plans are in: Claire stops
 * working when Lily is born, everyday spending creeps up with each step (+15% at VP, +20% after the house), private
 * K–12 school for both kids, and a layoff at 40 (severance, a year off, then $250k in corporate finance until
 * retiring at 55). Built with the app's own life-event templates so it looks like a plan made in the editor. The
 * rent ends the year the house is bought (both timed by age), so there's no gap between them. Re-running it
 * replaces the plan's document.
 *
 * Run: npx tsx scripts/seed-plan-john-persona.ts   (SEED_USER_ID picks the owner; default: the only user)
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { typicalRunningCosts } from "../src/lib/plans/plan-asset-costs"
import { blankPlanDocument, PLAN_SCHEMA_VERSION, RETIREMENT_MILESTONE_ID } from "../src/lib/plans/plan-constants"
import { COLLEGE_PRESET_COSTS } from "../src/lib/plans/plan-children"
import { applySocialSecurity } from "../src/lib/plans/income-templates"
import { applyBreak, applyCareer, applyChild, applyHome, applyMarried, applyMove, applyVehicle, applyWindfall } from "../src/lib/plans/milestone-templates"
import { planDocumentSchema } from "../src/lib/plans/plan-schema"
import { simulatePlan } from "../src/lib/plans/engine/simulate"
import type { PlanDocument, PlanExpense, PlanIncome, Timing } from "../src/lib/plans/plan-types"

const NAME = "John (banker, NJ)"
const PERSON = "person-1"
const BIRTH_YEAR = 2005
const START = new Date(2026, 0, 15)
const ASSOCIATE_AGE = 24
/** The MBA: two years without pay, from this age. */
const MBA_AGE = 27
const MBA_YEARS = 2
const VP_AGE = 29
const MARRY_AGE = 31
/** Moves to Morristown and buys the house at this age (2038). */
const MOVE_AGE = 33
/** Laid off at this age; a year later, a corporate job until retirement. */
const LAYOFF_AGE = 40
const RETIRE_AGE = 55
const BEACH_AGE = 38
/** Private school per child per year, today's dollars, from kindergarten through 12th grade. */
const PRIVATE_SCHOOL = 45_000

let n = 0
const newId = (prefix: string) => `${prefix}-john-${++n}`
const age = (a: number): Timing => ({ type: "age", personId: PERSON, age: a })
const toRetirement: Timing = { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID }

function expense(id: string, name: string, category: string, amount: number, end: Timing = { type: "planEnd" }, start: Timing = { type: "planStart" }): PlanExpense {
  return { id, name, category, amount, growth: null, start, end, oneTime: false }
}

const pay = (id: string, name: string, amount: number, contributions: PlanIncome["contributions"] = []): PlanIncome => ({
  id,
  name,
  kind: "salary",
  amount,
  growth: 0.03,
  start: { type: "planStart" },
  end: toRetirement,
  taxable: true,
  oneTime: false,
  personId: PERSON,
  contributions,
})

/** Today: 21, first year as an analyst, a shared apartment in NYC, a little saved and student loans. */
function today(): PlanDocument {
  const base = blankPlanDocument(START, 2026 - BIRTH_YEAR)
  return {
    ...base,
    settings: { ...base.settings, state: "NY", filingStatus: "single", endAge: 95, cashBuffer: 15_000, bufferAccountId: "acct-hysa" },
    people: [{ id: PERSON, name: "John", birthYear: BIRTH_YEAR, birthMonth: 4 }],
    accounts: [
      { id: "acct-cash", name: "Checking", taxTreatment: "cash", balance: 3_000, costBasis: null, returnRate: 0.01, owner: null, source: null },
      { id: "acct-hysa", name: "High-yield savings", taxTreatment: "cash", balance: 5_000, costBasis: null, returnRate: 0.038, owner: null, source: null },
      { id: "acct-brokerage", name: "Brokerage", taxTreatment: "taxable", balance: 0, costBasis: null, returnRate: 0.07, owner: null, source: null },
      { id: "acct-401k", name: "401(k)", taxTreatment: "traditional", balance: 3_000, costBasis: null, returnRate: 0.07, owner: null, source: null },
      { id: "acct-roth", name: "Roth IRA", taxTreatment: "roth", balance: 0, costBasis: null, returnRate: 0.07, owner: null, source: null },
    ],
    incomes: [
      pay("inc-salary", "Analyst salary", 110_000, [{ id: "contrib-401k", accountId: "acct-401k", percent: 0.1, employerMatchPercent: 0.04, preTax: true }]),
      pay("inc-bonus", "Analyst bonus", 90_000),
    ],
    expenses: [
      expense("exp-rent-shared", "Rent (shared NYC apartment)", "Housing", 30_000, age(ASSOCIATE_AGE)),
      expense("exp-rent", "Rent (Manhattan 1BR)", "Housing", 54_000, age(MOVE_AGE), age(ASSOCIATE_AGE)),
      expense("exp-mba", "MBA tuition & living", "Education", 95_000, age(MBA_AGE + MBA_YEARS), age(MBA_AGE)),
      expense("exp-food", "Food & dining out", "Food & Dining", 14_000),
      expense("exp-travel", "Travel", "Travel", 8_000),
      expense("exp-shopping", "Clothes & shopping", "Shopping", 6_000),
      expense("exp-fun", "Going out & entertainment", "Entertainment", 7_000),
      expense("exp-transport", "Subway, Ubers & car service", "Transportation", 3_000, age(MOVE_AGE)),
      expense("exp-commute", "NJ Transit commute", "Transportation", 6_000, toRetirement, age(MOVE_AGE)),
      expense("exp-health", "Health insurance & care", "Healthcare", 3_000),
      expense("exp-gym", "Gym", "Fitness", 2_000),
      expense("exp-utilities", "Utilities & internet", "Bills & Utilities", 2_000),
      expense("exp-phone", "Phone", "Phone & Data", 1_200),
      expense("exp-personal", "Personal care", "Personal Care", 1_500),
    ],
    assets: [],
    debts: [
      { id: "debt-undergrad", name: "Undergrad student loans", kind: "student", balance: 45_000, rate: 0.055, monthlyPayment: 490, start: { type: "planStart" }, assetId: null, source: null },
      { id: "debt-mba", name: "MBA student loans", kind: "student", balance: 150_000, rate: 0.075, monthlyPayment: 1_800, start: age(MBA_AGE), assetId: null, source: null },
    ],
    cashFlow: {
      surplusOrder: [
        { accountId: "acct-hysa", annualCap: null },
        { accountId: "acct-brokerage", annualCap: null },
      ],
      withdrawalOrder: ["acct-cash", "acct-hysa", "acct-brokerage", "acct-401k", "acct-roth"],
    },
    milestones: base.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: age(RETIRE_AGE) } : m)),
    children: [],
    adjustments: [],
    deposits: [],
  }
}

/** The income named `name` still running to retirement (the latest one, after promotions and the break). */
const current = (doc: PlanDocument, name: string) => [...doc.incomes].reverse().find((i) => i.name === name && i.end.type === "milestone" && i.end.milestoneId === RETIREMENT_MILESTONE_ID)!

/** Analyst → associate at 24, the MBA break at 27, VP at 29: salary and bonus move together. */
function career(doc: PlanDocument): PlanDocument {
  let next = applyCareer(doc, { incomeId: "inc-salary", when: age(ASSOCIATE_AGE), name: "Associate salary", amount: 200_000 }, newId)
  next = applyCareer(next, { incomeId: "inc-bonus", when: age(ASSOCIATE_AGE), name: "Associate bonus", amount: 150_000 }, newId)
  const mbaYear = BIRTH_YEAR + MBA_AGE
  next = applyBreak(next, { incomeId: current(next, "Associate salary").id, startYear: mbaYear, years: MBA_YEARS }, newId)
  next = applyBreak(next, { incomeId: current(next, "Associate bonus").id, startYear: mbaYear, years: MBA_YEARS }, newId)
  next = applyCareer(next, { incomeId: current(next, "Associate salary").id, when: age(VP_AGE), name: "VP salary", amount: 300_000 }, newId)
  return applyCareer(next, { incomeId: current(next, "Associate bonus").id, when: age(VP_AGE), name: "VP bonus", amount: 250_000 }, newId)
}

/** Laid off at 40: banker pay stops, severance, a year off, then corporate finance at $250k (no bonus). */
function layoff(doc: PlanDocument): PlanDocument {
  const vp = [current(doc, "VP salary").id, current(doc, "VP bonus").id]
  let next: PlanDocument = { ...doc, incomes: doc.incomes.map((i) => (vp.includes(i.id) ? { ...i, end: age(LAYOFF_AGE) } : i)) }
  next = applyWindfall(next, { name: "Laid off: severance", when: age(LAYOFF_AGE), amount: 150_000, taxable: true }, newId)
  const contributions = current(doc, "VP salary").contributions
  return { ...next, incomes: [...next.incomes, { ...pay("inc-corporate", "Corporate finance director", 250_000, contributions), start: age(LAYOFF_AGE + 1) }] }
}

/** Spending that grows with the career: more at VP, more after the house, private school, a beach house. */
function lifestyleCreep(doc: PlanDocument): PlanDocument {
  const adjustments = [
    ...(doc.adjustments ?? []),
    { id: newId("adj"), kind: "spending" as const, timing: age(VP_AGE), percent: 0.15 },
    { id: newId("adj"), kind: "spending" as const, timing: age(MOVE_AGE + 1), percent: 0.2 },
  ]
  const school = doc.children.map((c) =>
    expense(`exp-school-${c.id}`, `${c.name}: private school`, "Education", PRIVATE_SCHOOL, { type: "year", year: c.birthYear + 18 }, { type: "year", year: c.birthYear + 5 }),
  )
  const next = { ...doc, adjustments, expenses: [...doc.expenses, ...school] }
  return applyHome(next, { name: "Jersey Shore beach house", when: age(BEACH_AGE), price: 900_000, payWith: "loan", downPayment: 180_000, rate: 0.065, termYears: 30, appreciation: 0.035 }, newId)
}

/** Claire stops working when their first child is born. */
function claireStops(doc: PlanDocument): PlanDocument {
  const first = Math.min(...doc.children.map((c) => c.birthYear))
  return { ...doc, incomes: doc.incomes.map((i) => (i.name === "Claire's salary" ? { ...i, end: { type: "year" as const, year: first } } : i)) }
}

/** Marriage, kids, the move and the house, through the same templates the editor uses. */
function lifeEvents(doc: PlanDocument): PlanDocument {
  let next = layoff(career(doc))
  next = applyMarried(next, { when: age(MARRY_AGE), partner: { name: "Claire", birthYear: 2006 }, partnerIncome: 120_000, incomeTaxRate: 0.3, capitalGainsRate: 0.2, weddingCost: 60_000 }, newId)
  next = claireStops(withKids(next))
  next = applyMove(next, { name: "Move to Morristown, NJ", when: age(MOVE_AGE), percent: 0, state: "NJ" }, newId)
  next = applyHome(next, { name: "Morristown house", when: age(MOVE_AGE), price: 1_600_000, payWith: "loan", downPayment: 320_000, rate: 0.066, termYears: 30, appreciation: 0.035 }, newId)
  next = lifestyleCreep(next)
  next = applyVehicle(next, { name: "Family SUV", when: age(MOVE_AGE), price: 60_000, payWith: "loan", downPayment: 15_000, rate: 0.065, termYears: 5, appreciation: -0.15, replaceEveryYears: 8, vehicleAge: 0 }, newId)
  // Both homes are in NJ: property tax at NJ's rate, not New York's (the plan is in NY when it's created). The
  // Morristown house is where they live.
  next = { ...next, assets: next.assets.map((a) => (a.kind === "home" ? { ...a, runningCosts: typicalRunningCosts("home", "NJ"), primaryResidence: a.name === "Morristown house" } : a)) }
  const claire = next.people.find((p) => p.name === "Claire")!
  next = applySocialSecurity(next, { personId: PERSON, monthlyAtFra: 4_000, claimAge: 67 }, newId)
  return applySocialSecurity(next, { personId: claire.id, monthlyAtFra: 3_000, claimAge: 67 }, newId)
}

/** Lily (2038) and Max (2041): private college, a 529 each. */
function withKids(doc: PlanDocument): PlanDocument {
  let next = applyChild(doc, "Lily", 2038, newId)
  next = applyChild(next, "Max", 2041, newId)
  const accounts = next.children.map((c) => ({
    id: `acct-529-${c.id}`,
    name: `${c.name}'s 529`,
    taxTreatment: "education" as const,
    balance: 0,
    costBasis: null,
    returnRate: 0.06,
    owner: null,
    source: null,
  }))
  const children = next.children.map((c) => ({
    ...c,
    college: { ...c.college, enabled: true, preset: "private" as const, annualCost: COLLEGE_PRESET_COSTS.private },
    plan529: { enabled: true, accountId: `acct-529-${c.id}`, annualContribution: 10_000 },
  }))
  return { ...next, accounts: [...next.accounts, ...accounts], children }
}

async function main() {
  const userId = process.env.SEED_USER_ID ?? (await db.user.findFirst({ select: { id: true } }))?.id
  if (!userId) throw new Error("No user to own the plan")

  const parsed = planDocumentSchema.safeParse(lifeEvents(today()))
  if (!parsed.success) {
    console.error(parsed.error.issues)
    throw new Error("Built document failed schema validation")
  }
  const rows = simulatePlan(parsed.data).rows
  const short = rows.find((r) => r.shortfall > 0.5)
  console.log(`📊 Smoke test: ${rows.length} years, runs out: ${short ? short.year : "never"}, final net worth $${Math.round(rows.at(-1)!.netWorth).toLocaleString()}`)

  const existing = await db.plan.findFirst({ where: { userId, name: NAME }, select: { id: true } })
  const plan = existing
    ? await db.plan.update({ where: { id: existing.id }, data: { document: parsed.data }, select: { id: true } })
    : await db.plan.create({ data: { userId, name: NAME, document: parsed.data, schemaVersion: PLAN_SCHEMA_VERSION }, select: { id: true } })
  console.log(`✅ ${existing ? "Updated" : "Created"} "${NAME}" (${plan.id})`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

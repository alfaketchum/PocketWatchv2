/**
 * Seeds "Plan 2" with a fake persona: single woman, 25, renting in DC, with
 * average US finances for her demographic (salary, 401(k), student/auto/credit
 * debt, renter, first home purchase at 32, Social Security at 67).
 *
 * Run: npx tsx scripts/seed-plan-2-persona.ts
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { planDocumentSchema } from "../src/lib/plans/plan-schema"
import { blankPlanDocument } from "../src/lib/plans/plan-constants"
import { parsePlanDocument } from "../src/lib/plans/plan-schema"
import { yearlyBenefit } from "../src/lib/plans/social-security"
import { simulatePlan } from "../src/lib/plans/engine/simulate"
import type { PlanDocument, PlanExpense } from "../src/lib/plans/plan-types"

const PLAN_ID = process.env.SEED_PLAN_ID ?? "cmuqn981t0ofy7u0ysx24taby"

const PERSON = "person-1"
const RETIRE = "ms-retirement"
const FIRST_HOME = "ms-first-home"
const BIRTH_YEAR = 2001
const CLAIM_AGE = 67
const SS_MONTHLY_AT_FRA = 2200

function expense(id: string, name: string, category: string, amount: number, atFirstHome = false): PlanExpense {
  return {
    id,
    name,
    category,
    amount,
    growth: null,
    start: { type: "planStart" },
    end: atFirstHome ? { type: "milestone", milestoneId: FIRST_HOME } : { type: "planEnd" },
    oneTime: false,
  }
}

function buildDocument(settings: PlanDocument["settings"]): PlanDocument {
  return {
    settings: { ...settings, cashBuffer: 10_000, bufferAccountId: "acct-hysa", filingStatus: "single" },
    people: [{ id: PERSON, name: "Emma", birthYear: BIRTH_YEAR, birthMonth: 3 }],
    accounts: [
      { id: "acct-cash", name: "Checking", taxTreatment: "cash", balance: 4_200, costBasis: null, returnRate: 0.02, owner: null, source: null },
      { id: "acct-hysa", name: "High-yield savings", taxTreatment: "cash", balance: 8_500, costBasis: null, returnRate: 0.038, owner: null, source: null },
      { id: "acct-brokerage", name: "Brokerage", taxTreatment: "taxable", balance: 0, costBasis: null, returnRate: 0.07, owner: null, source: null },
      { id: "acct-401k", name: "401(k)", taxTreatment: "traditional", balance: 13_500, costBasis: null, returnRate: 0.06, owner: null, source: null },
      { id: "acct-roth", name: "Roth IRA", taxTreatment: "roth", balance: 4_800, costBasis: null, returnRate: 0.065, owner: null, source: null },
    ],
    incomes: [
      {
        id: "inc-salary",
        name: "Marketing coordinator",
        kind: "salary",
        amount: 58_000,
        growth: 0.03,
        start: { type: "planStart" },
        end: { type: "milestone", milestoneId: RETIRE },
        taxable: true,
        oneTime: false,
        personId: PERSON,
        contributions: [
          { id: "contrib-401k", accountId: "acct-401k", percent: 0.06, employerMatchPercent: 0.03, preTax: true },
          { id: "contrib-roth", accountId: "acct-roth", percent: 0.03, employerMatchPercent: 0, preTax: false },
        ],
      },
      {
        id: "inc-ss",
        name: "Social Security",
        kind: "social_security",
        amount: Math.round(yearlyBenefit(SS_MONTHLY_AT_FRA, BIRTH_YEAR, CLAIM_AGE)),
        growth: null,
        start: { type: "age", personId: PERSON, age: CLAIM_AGE },
        end: { type: "planEnd" },
        taxable: true,
        oneTime: false,
        personId: PERSON,
        contributions: [],
        socialSecurity: { pia: SS_MONTHLY_AT_FRA, claimAge: CLAIM_AGE },
      },
    ],
    expenses: [
      expense("exp-rent", "Rent (1BR apartment)", "Housing", 19_800, true),
      expense("exp-food", "Groceries & dining out", "Food & Dining", 7_200),
      expense("exp-transport", "Gas, insurance & metro", "Transportation", 3_120),
      expense("exp-utilities", "Utilities & internet", "Bills & Utilities", 2_520),
      expense("exp-phone", "Phone plan", "Phone & Data", 1_140),
      expense("exp-health", "Health insurance & care", "Healthcare", 2_520),
      expense("exp-personal", "Personal care", "Personal Care", 1_080),
      expense("exp-fitness", "Gym membership", "Fitness", 480),
      expense("exp-fun", "Streaming & going out", "Entertainment", 1_800),
      expense("exp-shopping", "Clothes & household", "Shopping", 2_640),
      expense("exp-travel", "One trip a year", "Travel", 2_000),
    ],
    assets: [
      {
        id: "asset-car",
        name: "Honda Civic (2020)",
        kind: "vehicle",
        value: 14_500,
        appreciation: -0.1,
        vehicleAge: 6,
        start: { type: "planStart" },
        end: { type: "planEnd" },
        acquired: "received",
      },
      {
        id: "asset-home",
        name: "First condo",
        kind: "home",
        value: 310_000,
        appreciation: 0.035,
        start: { type: "milestone", milestoneId: FIRST_HOME },
        end: { type: "planEnd" },
        acquired: "purchase",
        primaryResidence: true,
        financing: { mode: "loan", downShare: 0.1, rate: 0.065, termYears: 30 },
        runningCosts: [
          { name: "Property tax", amount: 0.009, basis: "percentOfValue", kind: "propertyTax" },
          { name: "Insurance & upkeep", amount: 4_200, basis: "dollars" },
        ],
      },
    ],
    debts: [
      { id: "debt-student", name: "Student loan", kind: "student", balance: 24_500, rate: 0.052, monthlyPayment: 265, start: { type: "planStart" }, assetId: null, source: null },
      { id: "debt-auto", name: "Car loan", kind: "auto", balance: 11_800, rate: 0.069, monthlyPayment: 280, start: { type: "planStart" }, assetId: "asset-car", source: null },
      { id: "debt-cc", name: "Credit card", kind: "credit", balance: 3_200, rate: 0.235, monthlyPayment: 120, start: { type: "planStart" }, assetId: null, source: null },
    ],
    cashFlow: {
      surplusOrder: [
        { accountId: "acct-hysa", annualCap: null },
        { accountId: "acct-brokerage", annualCap: null },
      ],
      withdrawalOrder: ["acct-cash", "acct-hysa", "acct-brokerage", "acct-401k", "acct-roth"],
    },
    milestones: [
      { id: RETIRE, name: "Retirement", kind: "retirement", timing: { type: "age", personId: PERSON, age: 65 } },
      { id: FIRST_HOME, name: "Buy first home", kind: "custom", timing: { type: "age", personId: PERSON, age: 36 }, icon: "home" },
    ],
    children: [],
    adjustments: [],
    deposits: [],
  }
}

async function main() {
  const plan = await db.plan.findUnique({ where: { id: PLAN_ID } })
  if (!plan) throw new Error(`Plan ${PLAN_ID} not found`)
  console.log(`🌱 Seeding "${plan.name}" (${plan.id}) with persona: Emma, 25, single`)

  const current = parsePlanDocument(plan.document, blankPlanDocument(new Date(), 25))
  if (!current) throw new Error("Stored document does not parse; refusing to overwrite")

  const doc = buildDocument(current.settings)
  const parsed = planDocumentSchema.safeParse(doc)
  if (!parsed.success) {
    console.error(parsed.error.issues)
    throw new Error("Built document failed schema validation")
  }

  const projection = simulatePlan(parsed.data)
  const last = projection.rows[projection.rows.length - 1]
  const shortfalls = projection.rows.filter((r) => r.shortfall > 0).length
  console.log(
    `📊 Smoke test: ${projection.rows.length} years, start net worth $${Math.round(projection.startNetWorth).toLocaleString()}, ` +
      `final financial net worth $${Math.round(last.financialNetWorth).toLocaleString()}, shortfall years: ${shortfalls}`,
  )

  await db.plan.update({ where: { id: plan.id }, data: { document: parsed.data } })
  console.log("✅ Plan 2 seeded")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

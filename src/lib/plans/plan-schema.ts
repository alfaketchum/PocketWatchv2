import { z } from "zod/v4"
import { PLAN_LIMITS } from "./plan-constants"
import type { PlanDocument } from "./plan-types"

const id = z.string().min(1).max(64)
const origin = id.optional()
const name = z.string().max(80)
const money = z.number().min(0).max(1e10)
const rate = z.number().min(-0.5).max(1)
const share = z.number().min(0).max(1)
const year = z.number().int().min(1900).max(2200)
const stateCode = z.string().regex(/^[A-Z]{2}$/)
const month = z.number().int().min(1).max(12)

const timing = z.discriminatedUnion("type", [
  z.object({ type: z.literal("planStart") }),
  z.object({ type: z.literal("planEnd") }),
  z.object({ type: z.literal("year"), year }),
  z.object({ type: z.literal("age"), personId: id, age: z.number().int().min(0).max(120) }),
  z.object({ type: z.literal("milestone"), milestoneId: id }),
])

const source = z.object({ kind: z.enum(["finance-account", "crypto", "real-asset"]), refId: z.string().min(1).max(128) }).nullable()

const settings = z.object({
  startYear: year,
  startMonth: month,
  endAge: z.number().int().min(1).max(120),
  inflation: z.number().min(-0.05).max(0.2),
  incomeTaxRate: share,
  capitalGainsRate: share,
  cashBuffer: money,
  // Added after launch; defaults keep older saved plans valid.
  bufferAccountId: id.nullable().default(null),
  protectBuffer: z.boolean().default(true),
  // Older plans keep flat rates until switched.
  taxMode: z.enum(["flat", "brackets"]).default("flat"),
  state: stateCode.nullable().default(null),
  filingStatus: z.enum(["single", "joint"]).default("single"),
})

const person = z.object({ id, name, birthYear: year, birthMonth: month, origin })

const account = z.object({
  id,
  name,
  taxTreatment: z.enum(["cash", "taxable", "traditional", "roth", "hsa", "education"]),
  balance: money,
  costBasis: money.nullable(),
  returnRate: rate,
  owner: id.nullable(),
  source,
  drainByYear: year.nullable().optional(),
  shortTermShare: share.optional(),
  realizedShare: share.optional(),
  origin,
})

const contribution = z.object({
  id,
  accountId: id,
  percent: share,
  employerMatchPercent: share,
  preTax: z.boolean(),
})

const income = z.object({
  id,
  name,
  kind: z.enum(["salary", "business", "social_security", "pension", "rental", "other"]),
  amount: money,
  growth: rate.nullable(),
  start: timing,
  end: timing,
  taxable: z.boolean(),
  oneTime: z.boolean(),
  contributions: z.array(contribution).max(PLAN_LIMITS.contributionsPerIncome),
  continues: id.optional(),
  origin,
})

const expense = z.object({
  id,
  name,
  category: z.string().max(80).nullable(),
  amount: money,
  growth: rate.nullable(),
  start: timing,
  end: timing,
  oneTime: z.boolean(),
  origin,
})

const asset = z.object({
  id,
  name,
  kind: z.enum(["home", "vehicle", "other"]),
  value: money,
  appreciation: rate,
  start: timing,
  end: timing,
  acquired: z.enum(["purchase", "received"]).optional(),
  costBasis: money.nullable().optional(),
  source: source.optional(),
  financing: z
    .object({
      mode: z.enum(["cash", "loan", "undecided"]),
      downShare: share,
      rate: z.number().min(0).max(1),
      termYears: z.number().int().min(1).max(50),
    })
    .optional(),
  runningCosts: z
    .array(z.object({ name, amount: z.number().min(0).max(1e8), basis: z.enum(["dollars", "percentOfValue"]) }))
    .max(10)
    .optional(),
  replaceEveryYears: z.number().int().min(1).max(50).nullable().optional(),
  origin,
})

const debt = z.object({
  id,
  name,
  kind: z.enum(["mortgage", "student", "auto", "credit", "other"]),
  balance: money,
  rate: z.number().min(0).max(1),
  monthlyPayment: money,
  start: timing,
  assetId: id.nullable(),
  source,
  origin,
})

const milestone = z.object({
  id,
  name,
  kind: z.enum(["retirement", "custom"]),
  timing,
  icon: z.string().max(40).optional(),
  origin,
})

const adjustment = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("taxRates"), timing, incomeTaxRate: share, capitalGainsRate: share, origin }),
  z.object({ id, kind: z.literal("spending"), timing, percent: z.number().min(-0.95).max(5), origin }),
  z.object({ id, kind: z.literal("filingStatus"), timing, status: z.enum(["single", "joint"]), origin }),
  z.object({ id, kind: z.literal("state"), timing, state: stateCode.nullable(), origin }),
])

const child = z.object({
  id,
  name,
  birthYear: year,
  raising: z.object({ enabled: z.boolean(), annualCost: money, untilAge: z.number().int().min(1).max(30) }),
  college: z.object({
    enabled: z.boolean(),
    preset: z.enum(["public_in_state", "public_out_of_state", "private", "custom"]),
    annualCost: money,
    startAge: z.number().int().min(10).max(40),
    years: z.number().int().min(1).max(10),
    growth: rate,
  }),
  plan529: z.object({ enabled: z.boolean(), accountId: id.nullable(), annualContribution: money }),
  support: z.object({ enabled: z.boolean(), annualAmount: money, years: z.number().int().min(1).max(40) }),
})

export const planDocumentSchema = z.object({
  settings,
  people: z.array(person).min(1).max(PLAN_LIMITS.people),
  accounts: z.array(account).max(PLAN_LIMITS.accounts),
  incomes: z.array(income).max(PLAN_LIMITS.incomes),
  expenses: z.array(expense).max(PLAN_LIMITS.expenses),
  assets: z.array(asset).max(PLAN_LIMITS.assets),
  debts: z.array(debt).max(PLAN_LIMITS.debts),
  cashFlow: z.object({
    surplusOrder: z.array(z.object({ accountId: id, annualCap: money.nullable() })).max(PLAN_LIMITS.accounts),
    withdrawalOrder: z.array(id).max(PLAN_LIMITS.accounts),
  }),
  milestones: z.array(milestone).max(PLAN_LIMITS.milestones),
  children: z.array(child).max(PLAN_LIMITS.children),
  adjustments: z.array(adjustment).max(PLAN_LIMITS.adjustments),
  deposits: z.array(z.object({ id, name, accountId: id, amount: money, timing, origin })).max(PLAN_LIMITS.deposits),
  ignoredSources: z.array(z.string().max(100)).max(200).optional(),
})

export const planNameSchema = z.string().trim().min(1, "Name is required").max(80)

/**
 * Stored document merged over `fallback` top-level keys, so newly added sections always exist.
 * Returns null when the stored document no longer validates.
 */
export function parsePlanDocument(stored: unknown, fallback: PlanDocument): PlanDocument | null {
  const merged = { ...fallback, ...(stored && typeof stored === "object" ? stored : {}) }
  const parsed = planDocumentSchema.safeParse(merged)
  return parsed.success ? parsed.data : null
}

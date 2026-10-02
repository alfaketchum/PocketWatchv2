/**
 * Adds RSUs to "Plan 2" (Emma, see seed-plan-2-persona.ts): she works at Capital One (COF, McLean VA) with a
 * new-hire grant and yearly refreshers. Merges into the plan as stored, so edits made in the app are kept;
 * re-running replaces only what this script adds.
 *
 * - New-hire grant: $20k at the plan's start month, 4 years even, 1-year cliff, then quarterly; sold at vest.
 * - Refreshers: $5k a year from next year, 4 years even, quarterly, no cliff; half kept in a COF stock account.
 *
 * Run: npx tsx scripts/seed-plan-2-rsus.ts
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { blankPlanDocument } from "../src/lib/plans/plan-constants"
import { parsePlanDocument, planDocumentSchema } from "../src/lib/plans/plan-schema"
import { simulatePlan } from "../src/lib/plans/engine/simulate"
import { equityValueToday } from "../src/lib/plans/engine/engine-equity"
import { fetchStockQuotes } from "../src/lib/market/stock-quotes"
import type { EquityGrant, PlanAccount, PlanDocument, PlanIncome } from "../src/lib/plans/plan-types"

const PLAN_ID = process.env.SEED_PLAN_ID ?? "cmuqn981t0ofy7u0ysx24taby"
const SYMBOL = "COF"
/** Used when the quote lookup fails. */
const FALLBACK_PRICE = 200
const PRICE_GROWTH = 0.06
const NEW_HIRE_VALUE = 20_000
const REFRESHER_VALUE = 5_000
const REFRESHER_KEPT = 0.5
const EVEN_4 = [0.25, 0.25, 0.25, 0.25]

const STOCK_ACCOUNT = "acct-cof-stock"
const NEW_HIRE = "inc-rsu-new-hire"
const REFRESHERS = "inc-rsu-refreshers"
const RETIRE = "ms-retirement"

async function price(): Promise<number> {
  const [quote] = await fetchStockQuotes([SYMBOL]).catch(() => [])
  if (quote?.price) return quote.price
  console.warn(`⚠️  No ${SYMBOL} quote; using $${FALLBACK_PRICE}`)
  return FALLBACK_PRICE
}

function rsu(id: string, name: string, grant: EquityGrant, start: PlanIncome["start"], kept: number): PlanIncome {
  return {
    id,
    name,
    kind: "equity",
    amount: equityValueToday(grant),
    growth: PRICE_GROWTH,
    start,
    end: { type: "milestone", milestoneId: RETIRE },
    taxable: true,
    oneTime: false,
    personId: "person-1",
    contributions: kept > 0 ? [{ id: `${id}-kept`, accountId: STOCK_ACCOUNT, percent: kept, employerMatchPercent: 0, preTax: false }] : [],
    equity: grant,
  }
}

function withRsus(doc: PlanDocument, sharePrice: number): PlanDocument {
  const { startYear, startMonth } = doc.settings
  const shares = (value: number) => Math.round(value / sharePrice)
  const newHire: EquityGrant = {
    symbol: SYMBOL,
    shares: shares(NEW_HIRE_VALUE),
    price: sharePrice,
    vesting: { yearly: EVEN_4, cliffMonths: 12, every: 3, grantMonth: startMonth, refresh: false },
  }
  const refreshers: EquityGrant = {
    symbol: SYMBOL,
    shares: shares(REFRESHER_VALUE),
    price: sharePrice,
    vesting: { yearly: EVEN_4, cliffMonths: 0, every: 3, grantMonth: 3, refresh: true },
  }
  const account: PlanAccount = {
    id: STOCK_ACCOUNT,
    name: "Capital One stock",
    taxTreatment: "taxable",
    balance: 0,
    costBasis: null,
    returnRate: PRICE_GROWTH,
    owner: null,
    source: null,
    mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 },
  }
  const ours = new Set([NEW_HIRE, REFRESHERS])
  return {
    ...doc,
    accounts: [...doc.accounts.filter((a) => a.id !== STOCK_ACCOUNT), account],
    incomes: [
      ...doc.incomes.filter((i) => !ours.has(i.id)),
      rsu(NEW_HIRE, "Capital One RSUs (new hire)", newHire, { type: "planStart" }, 0),
      rsu(REFRESHERS, "Capital One RSUs (refreshers)", refreshers, { type: "year", year: startYear + 1 }, REFRESHER_KEPT),
    ],
    cashFlow: {
      ...doc.cashFlow,
      withdrawalOrder: [...doc.cashFlow.withdrawalOrder.filter((id) => id !== STOCK_ACCOUNT), STOCK_ACCOUNT],
    },
  }
}

const equityBy = (doc: PlanDocument, index: number) =>
  simulatePlan(doc).rows[index]?.incomeBy ?? {}

async function main() {
  const plan = await db.plan.findUnique({ where: { id: PLAN_ID } })
  if (!plan) throw new Error(`Plan ${PLAN_ID} not found`)
  const current = parsePlanDocument(plan.document, blankPlanDocument(new Date(), 25))
  if (!current) throw new Error("Stored document does not parse; refusing to overwrite")

  const sharePrice = await price()
  console.log(`🌱 Adding ${SYMBOL} RSUs to "${plan.name}" at $${sharePrice.toFixed(2)} a share`)
  const parsed = planDocumentSchema.safeParse(withRsus(current, sharePrice))
  if (!parsed.success) {
    console.error(parsed.error.issues)
    throw new Error("Built document failed schema validation")
  }

  const projection = simulatePlan(parsed.data)
  const last = projection.rows[projection.rows.length - 1]
  const shortfalls = projection.rows.filter((r) => r.shortfall > 0).length
  for (const i of [0, 1, 2, 3, 4, 5]) {
    const by = equityBy(parsed.data, i)
    console.log(`   ${parsed.data.settings.startYear + i}: new hire $${Math.round(by[NEW_HIRE] ?? 0).toLocaleString()}, refreshers $${Math.round(by[REFRESHERS] ?? 0).toLocaleString()}`)
  }
  console.log(
    `📊 Smoke test: ${projection.rows.length} years, final financial net worth $${Math.round(last.financialNetWorth).toLocaleString()}, ` +
      `COF stock at the end $${Math.round(last.balances[STOCK_ACCOUNT] ?? 0).toLocaleString()}, shortfall years: ${shortfalls}`,
  )

  await db.plan.update({ where: { id: plan.id }, data: { document: parsed.data } })
  console.log("✅ RSUs added to Plan 2")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

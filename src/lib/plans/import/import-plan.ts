import { db } from "@/lib/db"
import { gatherBudgetContext } from "@/lib/finance/budget-ai-context"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"
import { blankPlanForUser } from "../plan-records"
import type { SourceBalances } from "../plan-refresh"
import type { PlanDocument } from "../plan-types"
import {
  accountsFromRows,
  cryptoAccount,
  debtsFromRows,
  expensesFromCategories,
  incomeFromMonthly,
  type ImportAccountRow,
  type ImportLiability,
} from "./import-mapping"

const PERCENT = 100

export interface ImportDraft {
  document: PlanDocument
  /** Items the preview leaves unticked: card balances are usually paid in full each month. */
  uncheckedIds: string[]
}

/** Visible, connected accounts, skipping SimpleFIN duplicates (same filter as /api/net-worth). */
export async function loadImportAccounts(userId: string): Promise<ImportAccountRow[]> {
  const rows = await db.financeAccount.findMany({
    where: { userId, isHidden: false, institution: { status: { not: "disconnected" } } },
    select: {
      id: true,
      name: true,
      type: true,
      subtype: true,
      currentBalance: true,
      apy: true,
      linkedExternalId: true,
      institution: { select: { provider: true, institutionName: true } },
    },
    take: 500,
  })
  return rows
    .filter((r) => !(r.institution.provider === "simplefin" && r.linkedExternalId))
    .map((r) => ({
      id: r.id,
      name: r.name,
      institution: r.institution.institutionName,
      type: r.type,
      subtype: r.subtype,
      currentBalance: r.currentBalance,
      apy: r.apy,
    }))
}

async function loadLiabilities(userId: string): Promise<ImportLiability[]> {
  const [mortgages, students, cards] = await Promise.all([
    db.financeLiabilityMortgage.findMany({
      where: { userId },
      select: { accountId: true, interestRatePercent: true, nextMonthlyPayment: true },
      take: 100,
    }),
    db.financeLiabilityStudentLoan.findMany({
      where: { userId },
      select: { accountId: true, interestRatePercent: true, minimumPaymentAmount: true },
      take: 100,
    }),
    db.financeLiabilityCreditCard.findMany({
      where: { userId },
      select: { accountId: true, aprs: true, minimumPaymentAmount: true },
      take: 100,
    }),
  ])
  const pct = (v: number | null) => (v === null ? null : v / PERCENT)
  return [
    ...mortgages.map((m) => ({ accountId: m.accountId, rate: pct(m.interestRatePercent), monthlyPayment: m.nextMonthlyPayment })),
    ...students.map((s) => ({ accountId: s.accountId, rate: pct(s.interestRatePercent), monthlyPayment: s.minimumPaymentAmount })),
    ...cards.map((c) => ({ accountId: c.accountId, rate: pct(purchaseApr(c.aprs)), monthlyPayment: c.minimumPaymentAmount })),
  ]
}

/** Purchase APR (percent) from Plaid's aprs JSON, else the highest listed. */
function purchaseApr(aprs: unknown): number | null {
  if (!Array.isArray(aprs)) return null
  const list = aprs.filter(
    (a): a is { aprPercentage: number; aprType: string } =>
      !!a && typeof a === "object" && typeof (a as { aprPercentage?: unknown }).aprPercentage === "number",
  )
  const purchase = list.find((a) => a.aprType === "purchase_apr")
  return purchase?.aprPercentage ?? (list.length ? Math.max(...list.map((a) => a.aprPercentage)) : null)
}

/** Live crypto value, falling back to the latest portfolio snapshot. */
export async function loadCryptoValue(userId: string): Promise<number> {
  try {
    const live = await buildBalancesForUser(userId)
    if (!live.error && live.totalValue > 0) return live.totalValue
  } catch (err) {
    console.warn("[plans] live crypto read failed, using snapshot:", err)
  }
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { totalValue: true },
  })
  return snapshot?.totalValue ?? 0
}

/** A plan pre-filled from the user's linked accounts, liabilities, income and spending. */
export async function buildImportDraft(userId: string): Promise<ImportDraft> {
  const [base, rows, liabilities, crypto, budget] = await Promise.all([
    blankPlanForUser(userId),
    loadImportAccounts(userId),
    loadLiabilities(userId),
    loadCryptoValue(userId),
    gatherBudgetContext(userId),
  ])
  const cryptoAcct = cryptoAccount(crypto)
  const accounts = [...accountsFromRows(rows), ...(cryptoAcct ? [cryptoAcct] : [])]
  const debts = debtsFromRows(rows, liabilities)
  const income = incomeFromMonthly(budget.income.monthly)
  const document: PlanDocument = {
    ...base,
    accounts,
    debts,
    incomes: income ? [income] : [],
    expenses: expensesFromCategories(budget.categories),
  }
  return { document, uncheckedIds: debts.filter((d) => d.kind === "credit").map((d) => d.id) }
}

/** Current balances of everything a plan can link back to, for "Refresh balances". */
export async function loadSourceBalances(userId: string): Promise<SourceBalances> {
  const [rows, crypto] = await Promise.all([loadImportAccounts(userId), loadCryptoValue(userId)])
  return {
    accounts: Object.fromEntries(rows.map((r) => [r.id, Math.abs(r.currentBalance ?? 0)])),
    crypto,
  }
}

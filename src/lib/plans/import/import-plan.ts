import { db } from "@/lib/db"
import { gatherBudgetContext } from "@/lib/finance/budget-ai-context"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"
import { blankPlanForUser } from "../plan-records"
import type { SourceBalances } from "../plan-refresh"
import type { PlanDebt, PlanDocument, PlanExpense } from "../plan-types"
import { withDetectedTrading } from "../trading-detect"
import {
  accountsFromRows,
  cryptoAccount,
  debtsFromRows,
  incomeFromMonthly,
  type ImportAccountRow,
  type ImportLiability,
} from "./import-mapping"
import { loadTradingActivity } from "./trading-activity"
import { valueAt } from "@/lib/finance/real-assets"
import { loadRealAssets } from "@/lib/finance/real-assets-store"
import { assetsFromRealAssets, spendingOptions, type ImportRealAsset, type SpendingBasis } from "./import-mapping"

const PERCENT = 100

export interface ImportDraft {
  /** Spending in `document` is the 12-month average; `spending` has each way of measuring it. */
  document: PlanDocument
  spending: Record<SpendingBasis, PlanExpense[]>
  /** Categories with a budget set (used by the "budget" option). */
  budgetedCategories: string[]
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

/** Homes and vehicles from Finance › Homes & Vehicles, valued today. */
export async function loadImportRealAssets(userId: string): Promise<ImportRealAsset[]> {
  const now = new Date()
  const assets = await loadRealAssets(userId)
  return assets.map((a) => ({ id: a.id, kind: a.kind, name: a.name, value: valueAt(a, now), appreciation: a.appreciation, loanAccountId: a.loanAccountId }))
}

/** A plan pre-filled from the user's linked accounts, liabilities, homes and vehicles, income and spending. */
export async function buildImportDraft(userId: string): Promise<ImportDraft> {
  const [base, rows, liabilities, crypto, budget, realAssets] = await Promise.all([
    blankPlanForUser(userId),
    loadImportAccounts(userId),
    loadLiabilities(userId),
    loadCryptoValue(userId),
    gatherBudgetContext(userId),
    loadImportRealAssets(userId),
  ])
  const cryptoAcct = cryptoAccount(crypto)
  const trading = await loadTradingActivity(userId, rows)
  const accounts = [...withDetectedTrading(accountsFromRows(rows), trading), ...(cryptoAcct ? [cryptoAcct] : [])]
  const owned = assetsFromRealAssets(realAssets, debtsFromRows(rows, liabilities))
  const debts = owned.debts
  const income = incomeFromMonthly(budget.income.monthly)
  const spending = spendingOptions(budget.categories, budget.currentBudgets)
  const document: PlanDocument = {
    ...base,
    accounts,
    assets: owned.assets,
    debts,
    incomes: income ? [income] : [],
    expenses: spending.average,
  }
  return {
    document,
    spending,
    budgetedCategories: budget.currentBudgets.filter((b) => b.monthlyLimit > 0).map((b) => b.category),
    uncheckedIds: debts.filter((d) => d.kind === "credit").map((d) => d.id),
  }
}

/** Mortgages and auto loans in the user's linked accounts, as plan debts (for matching to homes and cars). */
export async function loadLinkedLoans(userId: string, rows?: ImportAccountRow[]): Promise<PlanDebt[]> {
  const [accounts, liabilities] = await Promise.all([rows ?? loadImportAccounts(userId), loadLiabilities(userId)])
  return debtsFromRows(accounts, liabilities).filter((d) => d.kind === "mortgage" || d.kind === "auto")
}

/** Current balances of everything a plan can link back to, plus brokerage trading and loans, for "Refresh balances". */
export async function loadSourceBalances(userId: string): Promise<SourceBalances> {
  const [rows, crypto, realAssets] = await Promise.all([loadImportAccounts(userId), loadCryptoValue(userId), loadImportRealAssets(userId)])
  const [trading, loans] = await Promise.all([loadTradingActivity(userId, rows), loadLinkedLoans(userId, rows)])
  return {
    accounts: Object.fromEntries(rows.map((r) => [r.id, Math.abs(r.currentBalance ?? 0)])),
    crypto,
    realAssets: Object.fromEntries(realAssets.map((a) => [a.id, Math.round(a.value)])),
    trading,
    loans,
  }
}

import { DEFAULT_CASH_BUFFER } from "./plan-constants"
import { withdrawalSequence } from "./engine/engine-cashflow"
import type { PlanDocument } from "./plan-types"

/**
 * Basic hides controls to cut decision fatigue; Advanced shows everything. Purely a view: both read and write the
 * same plan document, so switching never changes a plan or its numbers.
 */
export type PlanMode = "basic" | "advanced"

/** Editor tabs shown in Basic (Cash flow's waterfalls are Advanced; the plan keeps its default orders). */
export const BASIC_TABS: readonly string[] = ["assumptions", "accounts", "income", "expenses", "assets", "milestones", "overview"]

/** Chart views shown in Basic. */
export const BASIC_CHART_VIEWS: readonly string[] = ["networth", "income", "expenses"]

/** The one ledger view Basic shows. */
export const BASIC_LEDGER_VIEW = "summary"

/** Milestone templates offered in Basic; the rest (divorce, elder care, inheritance…) are Advanced. */
export const BASIC_MILESTONE_TEMPLATES: readonly string[] = [
  "retire", "married", "socialSecurity", "child", "home", "vehicle", "career", "move", "windfall", "custom",
]

/** A setting Basic hides that this plan uses, so its numbers reflect something Basic doesn't show. */
export interface AdvancedSetting {
  key: string
  label: string
  /** The editor tab where it's set in Advanced. */
  tab: string
}

type Check = AdvancedSetting & { inUse: (doc: PlanDocument) => boolean }

/** Made by the user, not by a milestone template (templates own and explain what they create). */
const own = <T extends { origin?: string }>(items: T[]): T[] => items.filter((i) => !i.origin)

function customWithdrawalOrder(doc: PlanDocument): boolean {
  if (doc.cashFlow.withdrawalOrder.length === 0) return false
  const ids = (d: PlanDocument) => withdrawalSequence(d).map((a) => a.id).join()
  return ids(doc) !== ids({ ...doc, cashFlow: { ...doc.cashFlow, withdrawalOrder: [] } })
}

const CHECKS: Check[] = [
  { key: "flatTax", label: "Flat tax rates", tab: "assumptions", inUse: (d) => d.settings.taxMode === "flat" },
  { key: "marketInflation", label: "Market inflation", tab: "assumptions", inUse: (d) => (d.settings.inflationMode ?? "custom") !== "custom" },
  { key: "ssCut", label: "Social Security cut", tab: "assumptions", inUse: (d) => !!d.settings.ssCut },
  { key: "credit", label: "Credit score", tab: "assumptions", inUse: (d) => !!d.settings.credit },
  { key: "adjustments", label: "Changes over time", tab: "assumptions", inUse: (d) => own(d.adjustments).length > 0 },
  { key: "realReturns", label: "Returns after inflation", tab: "accounts", inUse: (d) => d.settings.returnBasis === "real" },
  { key: "costBasis", label: "Cost basis", tab: "accounts", inUse: (d) => own(d.accounts).some((a) => a.costBasis !== null) },
  { key: "trading", label: "Trading activity", tab: "accounts", inUse: (d) => d.accounts.some((a) => (a.shortTermShare ?? 0) > 0 || (a.realizedShare ?? 0) > 0) },
  { key: "inherited", label: "Inherited account rules", tab: "accounts", inUse: (d) => own(d.accounts).some((a) => a.drainByYear != null) },
  { key: "equity", label: "Equity pay", tab: "income", inUse: (d) => d.incomes.some((i) => !!i.equity) },
  { key: "contributions", label: "Payroll contributions", tab: "income", inUse: (d) => d.incomes.some((i) => i.contributions.length > 0) },
  { key: "ssEarnings", label: "Social Security from earnings", tab: "income", inUse: (d) => d.incomes.some((i) => !!i.socialSecurity?.earnings) },
  { key: "incomeGrowth", label: "Custom income growth", tab: "income", inUse: (d) => own(d.incomes).some((i) => i.growth !== null) },
  { key: "deposits", label: "Deposits into accounts", tab: "income", inUse: (d) => own(d.deposits).length > 0 },
  {
    key: "patterns",
    label: "Spending patterns",
    tab: "expenses",
    inUse: (d) => !!d.settings.spendingProfile || d.expenses.some((e) => !!e.pattern && (e.pattern.preset !== "steady" || !!e.pattern.then)),
  },
  { key: "spendingRule", label: "Spending rule", tab: "expenses", inUse: (d) => !!d.settings.spendingRule },
  { key: "expenseGrowth", label: "Custom spending growth", tab: "expenses", inUse: (d) => own(d.expenses).some((e) => !e.costOf && e.growth !== null) },
  { key: "college", label: "529 savings", tab: "expenses", inUse: (d) => d.children.some((c) => c.plan529.enabled) },
  {
    key: "assetDetails",
    label: "Home & vehicle details",
    tab: "assets",
    inUse: (d) =>
      own(d.assets).some((a) => !!a.rental || !!a.fallback || !!a.replaceEveryYears || a.acquired === "received" || a.costBasis != null),
  },
  { key: "heloc", label: "Home equity line", tab: "assets", inUse: (d) => d.debts.some((x) => x.kind === "heloc") },
  { key: "cashBuffer", label: "Cash buffer", tab: "cashflow", inUse: (d) => d.settings.cashBuffer !== DEFAULT_CASH_BUFFER || d.settings.bufferAccountId !== null || !d.settings.protectBuffer },
  { key: "surplusOrder", label: "Where savings go", tab: "cashflow", inUse: (d) => d.cashFlow.surplusOrder.length > 0 },
  { key: "withdrawalOrder", label: "Withdrawal order", tab: "cashflow", inUse: customWithdrawalOrder },
  { key: "earlyPenalty", label: "Early retirement-account withdrawals", tab: "cashflow", inUse: (d) => d.cashFlow.avoidEarlyPenalty === false },
]

/** Every Advanced-only setting this plan uses, in tab order; empty when Basic shows the whole story. */
export function advancedSettingsInUse(doc: PlanDocument): AdvancedSetting[] {
  return CHECKS.filter((c) => c.inUse(doc)).map(({ key, label, tab }) => ({ key, label, tab }))
}

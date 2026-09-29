/**
 * Prompt + parser for AI budget generation: turns a BudgetContext into a
 * proposed monthly lifestyle budget with a short reason per category.
 */

import { getLifestyleCategories } from "@/lib/finance/budget-builder-config"
import type { BudgetContext, CategoryHistory } from "@/lib/finance/budget-ai-context"

export interface BudgetPlanProposal {
  summary: string
  categories: Array<{ category: string; amount: number; reason: string }>
}

const MAX_REASON = 180
const MAX_SUMMARY = 600

const money = (n: number) => `$${Math.round(n)}`

function formatCategory(c: CategoryHistory, monthCount: number): string {
  const head = `- ${c.category}: avg ${money(c.avgMonthly)}/mo, median ${money(c.medianMonthly)}/mo, active ${c.activeMonths}/${monthCount} months | monthly ${c.monthly.map(money).join(", ")}`
  const subs = c.subcategories
    .map((s) => `    · ${s.name}: avg ${money(s.avgMonthly)}/mo, median ${money(s.medianMonthly)}/mo, ${s.activeMonths}/${monthCount} months, ${s.txCount} txns`)
    .join("\n")
  const merchants = c.topMerchants.length > 0
    ? `\n    top merchants: ${c.topMerchants.map((m) => `${m.name} ${money(m.avgMonthly)}/mo`).join(", ")}`
    : ""
  return `${head}${subs ? `\n${subs}` : ""}${merchants}`
}

function formatIncome(ctx: BudgetContext): string {
  const { income } = ctx
  if (income.kind === "variable") {
    return `INCOME: variable (avg ${money(income.monthly)}/mo, irregular — e.g. investment income). Context only: do NOT cap or scale the budget by income.`
  }
  const source = income.source === "override" ? "user-entered" : "detected from regular deposits"
  return `INCOME: steady ${money(income.monthly)}/mo (${source}). The budget total must fit within it and leave room to save (aim for 10-20% when feasible).`
}

function formatContext(ctx: BudgetContext): string {
  const n = ctx.months.length
  const subs = ctx.subscriptions.length > 0
    ? ctx.subscriptions.map((s) => `- ${s.name}: ${money(s.monthly)}/mo (${s.category ?? "uncategorized"})`).join("\n")
    : "- none detected"
  const budgets = ctx.currentBudgets.length > 0
    ? ctx.currentBudgets.map((b) => `- ${b.category}: ${money(b.monthlyLimit)}`).join("\n")
    : "- none yet"

  return `MONTHS ANALYZED (${n} complete months, oldest → newest): ${ctx.months.join(", ")}
LIFESTYLE SPENDING: avg ${money(ctx.avgMonthlySpend)}/mo; typical month (sum of category medians) ${money(ctx.typicalMonthlySpend)}

SPENDING BY CATEGORY (with subcategories):
${ctx.categories.map((c) => formatCategory(c, n)).join("\n") || "- no spending history"}

RECURRING SUBSCRIPTIONS (${money(ctx.subscriptionsMonthly)}/mo total):
${subs}

CURRENT BUDGETS:
${budgets}

${formatIncome(ctx)}
- Taxes (context only, never budget them): ${money(ctx.taxes.total)} paid across ${ctx.taxes.paymentMonths} month(s). They are planned separately.`
}

export function buildBudgetPlanPrompt(ctx: BudgetContext): string {
  return `You are a personal finance coach building a realistic MONTHLY LIFESTYLE budget from the user's real data.
A budget here means the day-to-day cost of the user's lifestyle: housing, food, transport, shopping, travel, fun and so on.
It is not a savings plan. Income only constrains it when income is steady (see INCOME below).
Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just JSON.

SCHEMA:
{
  "summary": "string (2-3 sentences: what a normal month of this lifestyle costs, the total budgeted, the key trade-offs, and — only if income is steady — how much it leaves to save)",
  "categories": [{ "category": "string (one of the allowed categories)", "amount": number (whole dollars per month), "reason": "string (under ${MAX_REASON} chars, cite real numbers and the subcategories driving it)" }]
}

ALLOWED CATEGORIES: ${getLifestyleCategories().join(", ")}

${formatContext(ctx)}

RULES:
- Read the subcategories: they show what actually drives each category (e.g. Restaurants vs Groceries vs Bars, Hotels vs Flights, Rideshare vs Transit).
  Build each category's amount from its recurring subcategories, and name them in the reason.
- Budget every category with meaningful recurring spending. A subcategory active in only 1-2 months is a one-off: exclude it, or spread it thinly if it is plausibly annual.
- Prefer the median over the mean when a category or subcategory has spikes.
- Weigh recent months more heavily when spending has clearly shifted (e.g. a rent change), but use the longer history for annual and seasonal costs (spread them monthly).
- Fixed costs (rent, utilities, insurance, subscriptions) should cover what the user actually pays now.
- Trim discretionary subcategories where history shows room, but stay achievable (not below ~80% of the typical month without reason).
- Never budget taxes. Apply the INCOME instruction exactly as stated.
- Respect current budgets where they already fit the data; change them only with a clear reason.
- Round amounts to the nearest $5.`
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

export function parseBudgetPlanResponse(rawText: string): BudgetPlanProposal {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("AI response contained no JSON")
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  const allowed = new Set(getLifestyleCategories())
  const seen = new Set<string>()
  const categories = (Array.isArray(parsed.categories) ? parsed.categories : [])
    .map((c: Record<string, unknown>) => ({
      category: String(c.category ?? ""),
      amount: Math.round(num(c.amount) ?? 0),
      reason: String(c.reason ?? "").slice(0, MAX_REASON),
    }))
    .filter((c) => {
      if (!allowed.has(c.category) || c.amount <= 0 || seen.has(c.category)) return false
      seen.add(c.category)
      return true
    })

  if (categories.length === 0) throw new Error("AI proposed no valid budget categories")

  return {
    summary: String(parsed.summary ?? "").slice(0, MAX_SUMMARY),
    categories,
  }
}

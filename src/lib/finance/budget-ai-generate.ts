/**
 * Prompt + parser for AI budget generation: turns a BudgetContext into a
 * complete proposed monthly budget with a short reason per category.
 */

import { getBudgetableCategories } from "@/lib/finance/categories"
import type { BudgetContext } from "@/lib/finance/budget-ai-context"

export interface BudgetPlanProposal {
  summary: string
  monthlyIncome: number
  savingsTarget: number
  categories: Array<{ category: string; amount: number; reason: string }>
}

const MAX_REASON = 160
const MAX_SUMMARY = 600

const money = (n: number) => `$${Math.round(n)}`

function formatContext(ctx: BudgetContext): string {
  const categoryLines = ctx.categories.map((c) => {
    const merchants = c.topMerchants.length > 0
      ? ` | top: ${c.topMerchants.map((m) => `${m.name} ${money(m.avgMonthly)}/mo`).join(", ")}`
      : ""
    return `- ${c.category}: avg ${money(c.avgMonthly)}/mo, median ${money(c.medianMonthly)}/mo | monthly ${c.monthly.map(money).join(", ")}${merchants}`
  }).join("\n")

  const subs = ctx.subscriptions.length > 0
    ? ctx.subscriptions.map((s) => `- ${s.name}: ${money(s.monthly)}/mo (${s.category ?? "uncategorized"})`).join("\n")
    : "- none detected"

  const budgets = ctx.currentBudgets.length > 0
    ? ctx.currentBudgets.map((b) => `- ${b.category}: ${money(b.monthlyLimit)}`).join("\n")
    : "- none yet"

  const income = ctx.incomeOverride != null
    ? `${money(ctx.incomeOverride)}/mo (user-entered); transactions average ${money(ctx.avgMonthlyIncome)}/mo`
    : `${money(ctx.avgMonthlyIncome)}/mo average from Income transactions`

  return `MONTHS ANALYZED (${ctx.months.length} complete months, oldest → newest): ${ctx.months.join(", ")}
INCOME: ${income}
AVERAGE MONTHLY SPENDING: ${money(ctx.avgMonthlySpend)} (typical month, sum of category medians: ${money(ctx.typicalMonthlySpend)})

SPENDING BY CATEGORY:
${categoryLines || "- no spending history"}

RECURRING SUBSCRIPTIONS (${money(ctx.subscriptionsMonthly)}/mo total):
${subs}

CURRENT BUDGETS:
${budgets}`
}

export function buildBudgetPlanPrompt(ctx: BudgetContext): string {
  return `You are a personal finance coach building a realistic MONTHLY budget from the user's real data.
Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just JSON.

SCHEMA:
{
  "summary": "string (2-3 sentences: the strategy, total budgeted, and how much this leaves for savings)",
  "monthlyIncome": number (the monthly income you planned around),
  "savingsTarget": number (monthly amount left unbudgeted for savings; can be 0),
  "categories": [{ "category": "string (one of the allowed categories)", "amount": number (whole dollars per month), "reason": "string (under ${MAX_REASON} chars, cite real numbers)" }]
}

ALLOWED CATEGORIES: ${getBudgetableCategories().join(", ")}

${formatContext(ctx)}

RULES:
- Budget every category with meaningful recurring spending; skip one-off spikes unless they recur.
- Large irregular payments (e.g. estimated/annual tax payments) are not monthly spending: leave them out of the budget unless they recur monthly, and mention them in the summary.
- Prefer the median over the mean when a category has spikes.
- Weigh recent months more heavily when spending has clearly shifted, but use the longer history to catch annual and seasonal costs (spread them monthly).
- Fixed costs (Housing, Bills & Utilities, Insurance, subscriptions) should cover what the user actually pays.
- Trim discretionary categories where history shows room, but stay achievable (not below ~80% of the average without reason).
- If income is known, total budget + savingsTarget should not exceed income; aim for 10-20% savings when feasible.
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

  const allowed = new Set(getBudgetableCategories())
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
    monthlyIncome: Math.max(0, Math.round(num(parsed.monthlyIncome) ?? 0)),
    savingsTarget: Math.max(0, Math.round(num(parsed.savingsTarget) ?? 0)),
    categories,
  }
}

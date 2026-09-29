import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getCached, setCache } from "@/lib/cache"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { resolveBudgetAIProvider, getProviderLabel } from "@/lib/finance/ai-budget-provider"
import { gatherBudgetContext } from "@/lib/finance/budget-ai-context"
import { buildBudgetPlanPrompt, parseBudgetPlanResponse, type BudgetPlanProposal } from "@/lib/finance/budget-ai-generate"
import { DEFAULT_BUDGET_LOOKBACK, isBudgetLookback } from "@/lib/finance/budget-builder-config"
import { NextRequest, NextResponse } from "next/server"

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface GeneratedPlan {
  proposal: BudgetPlanProposal
  monthsAnalyzed: number
  providerLabel: string
  generatedAt: string
}

/**
 * POST: Ask the user's AI provider to propose a complete monthly budget from
 * their spending history, income, subscriptions and current budgets.
 * Returns the proposal only — nothing is saved (the client reviews + saves via /budgets/bulk).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("BGN01", "Authentication required", 401)

  const monthsParam = Number(request.nextUrl.searchParams.get("months") ?? DEFAULT_BUDGET_LOOKBACK)
  if (!isBudgetLookback(monthsParam)) return apiError("BGN05", "Invalid lookback months", 400)
  const month = new Date().toISOString().slice(0, 7)
  const cacheKey = `budget-plan:${user.id}:${month}:${monthsParam}`
  const force = request.nextUrl.searchParams.get("force") === "true"

  if (!force) {
    const cached = getCached<GeneratedPlan>(cacheKey)
    if (cached) return NextResponse.json(cached)
  }

  try {
    const ai = await resolveBudgetAIProvider(user.id)
    if (ai.isRemote) {
      const rl = financeRateLimiters.aiGenerate(getClientId(request))
      if (!rl.success) return apiError("BGN02", "Rate limit exceeded. Try again in a few minutes.", 429)
    }

    const ctx = await gatherBudgetContext(user.id, monthsParam)
    if (ctx.categories.length === 0) {
      return apiError("BGN03", "Not enough spending history to build a budget yet.", 422)
    }

    const rawText = await ai.run(buildBudgetPlanPrompt(ctx))
    const result: GeneratedPlan = {
      proposal: parseBudgetPlanResponse(rawText),
      monthsAnalyzed: ctx.months.length,
      providerLabel: getProviderLabel(ai.provider),
      generatedAt: new Date().toISOString(),
    }
    setCache(cacheKey, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("BGN04", "AI budget generation failed. Please try again.", 500, err)
  }
}

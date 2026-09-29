/**
 * Resolves the user's AI provider (verified stored key, else Claude CLI fallback)
 * and runs a raw-text prompt against it. Shared by the budget AI routes.
 */

import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"

export const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

export interface BudgetAIProvider {
  provider: AIProviderType
  /** True when the provider is a remote API (subject to rate limiting). */
  isRemote: boolean
  run: (prompt: string) => Promise<string>
}

export async function resolveBudgetAIProvider(userId: string): Promise<BudgetAIProvider> {
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  // Web search so the model can reference current external context when useful.
  if (!providerKey) {
    const provider: AIProviderType = "ai_claude_cli"
    return {
      provider,
      isRemote: false,
      run: (prompt) => callAIProviderRaw({ provider, apiKey: "enabled", model: undefined }, prompt, { webSearch: true }),
    }
  }

  const provider = providerKey.serviceName as AIProviderType
  const webSearch = provider === "ai_claude_api" || provider === "ai_claude_cli"
  return {
    provider,
    isRemote: provider !== "ai_claude_cli",
    run: async (prompt) => {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      return callAIProviderRaw({ provider, apiKey, model: providerKey.model ?? undefined }, prompt, { webSearch })
    },
  }
}

export { getProviderLabel }

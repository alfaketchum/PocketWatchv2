import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { invalidateStakingResponseCache } from "@/app/api/portfolio/staking/route"
import { invalidateBalancesResponseCache } from "@/lib/portfolio/balances-response"
import { invalidateLpBalancesCache } from "@/app/api/portfolio/balances/lp/route"
import { invalidateExchangeBalancesCache } from "@/app/api/portfolio/balances/exchange/route"
import { invalidateBlockchainBalancesCache } from "@/app/api/portfolio/balances/blockchain/route"
import { invalidatePricesCache } from "@/app/api/portfolio/prices/route"
import { invalidateCache } from "@/lib/cache"

/**
 * POST /api/user/clear-data
 * Wipes all cached/derived data across portfolio and finance modules.
 * Also removes all finance institutions (including manual uploads),
 * their accounts, and transactions.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("U9001", "Authentication required", 401)

  try {
    const results = await db.$transaction(async (tx) => {
      const [
        txCache, syncStates, chartCache, portfolioSnaps, projectedChart,
        exchangeTxCache, exchangeSyncStates, exchangeBalSnaps, stakingPositions, stakingSyncState, stakingSnaps,
        financeBudgets, financeSnaps, subscriptions, recurringStreams, creditCards, categoryRules,
        plaidSnaps, financeCreds,
        wallets, apiKeys,
        gates, jobs,
      ] = await Promise.all([
        // Portfolio — cached/derived data
        tx.transactionCache.deleteMany({ where: { userId: user.id } }),
        tx.transactionSyncState.deleteMany({ where: { userId: user.id } }),
        tx.chartCache.deleteMany({ where: { userId: user.id } }),
        tx.portfolioSnapshot.deleteMany({ where: { userId: user.id } }),
        tx.projectedChartCache.deleteMany({ where: { userId: user.id } }),
        tx.exchangeTransactionCache.deleteMany({ where: { userId: user.id } }),
        tx.exchangeSyncState.deleteMany({ where: { userId: user.id } }),
        tx.exchangeBalanceSnapshot.deleteMany({ where: { userId: user.id } }),
        tx.stakingPosition.deleteMany({ where: { userId: user.id } }),
        tx.stakingSyncState.deleteMany({ where: { userId: user.id } }),
        tx.stakingSnapshot.deleteMany({ where: { userId: user.id } }),
        // Finance — derived data
        tx.financeBudget.deleteMany({ where: { userId: user.id } }),
        tx.financeSnapshot.deleteMany({ where: { userId: user.id } }),
        tx.financeSubscription.deleteMany({ where: { userId: user.id } }),
        tx.financeRecurringStream.deleteMany({ where: { userId: user.id } }),
        tx.creditCardProfile.deleteMany({ where: { userId: user.id } }),
        tx.financeCategoryRule.deleteMany({ where: { userId: user.id } }),
        tx.plaidDataSnapshot.deleteMany({ where: { userId: user.id } }),
        tx.financeCredential.deleteMany({ where: { userId: user.id } }),
        // Portfolio — wallets and API keys (prevents re-fetch from providers)
        tx.trackedWallet.deleteMany({ where: { userId: user.id } }),
        tx.externalApiKey.deleteMany({ where: { userId: user.id } }),
        // Jobs / gates
        tx.providerCallGate.deleteMany({ where: { userId: user.id } }),
        tx.historySyncJob.updateMany({
          where: { userId: user.id, status: { in: ["queued", "running"] } },
          data: { status: "failed", completedAt: new Date(), error: "reset_by_clear_data" },
        }),
      ])

      // Finance — wipe all institutions (cascade deletes accounts + transactions)
      const financeInstitutions = await tx.financeInstitution.deleteMany({
        where: { userId: user.id },
      })

      // Wipe portfolio settings entirely
      await tx.portfolioSetting.deleteMany({ where: { userId: user.id } })

      return {
        transactionCache: txCache.count,
        syncStates: syncStates.count,
        chartCache: chartCache.count,
        portfolioSnapshots: portfolioSnaps.count,
        exchangeTxCache: exchangeTxCache.count,
        stakingPositions: stakingPositions.count,
        stakingSnapshots: stakingSnaps.count,
        wallets: wallets.count,
        apiKeys: apiKeys.count,
        financeBudgets: financeBudgets.count,
        financeSnapshots: financeSnaps.count,
        financeInstitutions: financeInstitutions.count,
        subscriptions: subscriptions.count,
        creditCards: creditCards.count,
      }
    })

    invalidateStakingResponseCache(user.id)
    invalidateBalancesResponseCache(user.id)
    invalidateLpBalancesCache(user.id)
    invalidateExchangeBalancesCache(user.id)
    invalidateBlockchainBalancesCache(user.id)
    invalidatePricesCache(user.id)

    // Flush all server-side in-memory caches for this user
    invalidateCache(`finance-insights:${user.id}`)
    invalidateCache(`deep-insights:${user.id}`)
    invalidateCache(`finance-trends:${user.id}`)
    invalidateCache(`finance-spending-by-month:${user.id}`)
    invalidateCache(`budget-suggest:${user.id}`)
    invalidateCache(`budget-ai:${user.id}`)
    invalidateCache(`cancel-guide:${user.id}`)
    invalidateCache(`ai-insights:${user.id}`)
    invalidateCache(`${user.id}:`)

    return NextResponse.json({ success: true, purged: results })
  } catch (error) {
    return apiError("U9002", "Failed to clear data", 500, error)
  }
}

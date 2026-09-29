"use client"

import { useMemo } from "react"
import { useFireInputs } from "./use-fire-profile"
import { useFireBaseline, useFireHistoryData } from "./use-fire-baseline"
import { useFinanceAccounts } from "./use-accounts"
import { useFireCryptoTiers } from "./use-fire-crypto"
import { analyzePlan, simOptionsForPlan } from "@/lib/fire/fire-analysis"
import { resolvePlan } from "@/lib/fire/fire-plan"
import { buildAllocation, portfolioAccounts } from "@/lib/fire/fire-portfolio"
import { investableHistory, nowFractionalYear } from "@/lib/fire/fire-history"
import { categoryCosts } from "@/lib/fire/fire-spending-cost"
import { resolveDrops, stressSummary } from "@/lib/fire/crypto-stress"

/** Everything the FIRE pages render from: inputs, baseline, plan, analysis, allocation, history. */
export function useFirePlan() {
  const { inputs, update, isLoading: inputsLoading, isSaving } = useFireInputs()
  const { baseline, netWorth, trendMonths, isLoading: baselineLoading } = useFireBaseline()
  const accountsQuery = useFinanceAccounts()
  const cryptoTiersQuery = useFireCryptoTiers(inputs.includeCrypto)
  const history = useFireHistoryData()
  const currentCape = history.data?.latestCape ?? null

  const plan = useMemo(() => resolvePlan(inputs, baseline, currentCape), [inputs, baseline, currentCape])
  const analysis = useMemo(() => analyzePlan(inputs, plan, nowFractionalYear(new Date())), [inputs, plan])

  const accounts = useMemo(() => portfolioAccounts(accountsQuery.data ?? []), [accountsQuery.data])
  const allocation = useMemo(
    () =>
      buildAllocation({
        accounts,
        stablecoins: netWorth?.crypto.stablecoins ?? 0,
        digital: netWorth?.crypto.digitalAssets ?? 0,
        mixes: inputs.accountMixes,
        includeCash: inputs.includeCash,
        includeCrypto: inputs.includeCrypto,
        cryptoTreatment: inputs.cryptoTreatment,
        annualSpend: plan.annualSpend,
        cryptoTiers: cryptoTiersQuery.data?.tiers ?? null,
      }),
    [accounts, netWorth, inputs.accountMixes, inputs.includeCash, inputs.includeCrypto, inputs.cryptoTreatment, plan.annualSpend, cryptoTiersQuery.data],
  )

  const cryptoStress = useMemo(() => {
    const c = allocation.byClass
    if (!inputs.includeCrypto || !cryptoTiersQuery.data || c.btc + c.eth + c.top100 + c.longTail <= 0) return null
    const tiers = { btc: c.btc, eth: c.eth, top100: c.top100, longTail: c.longTail, stable: c.stablecoins }
    return stressSummary(tiers, resolveDrops(inputs.cryptoStressPreset, inputs.cryptoDrops), plan, analysis.fireNumber, inputs.realReturn)
  }, [allocation, inputs.includeCrypto, inputs.cryptoStressPreset, inputs.cryptoDrops, inputs.realReturn, cryptoTiersQuery.data, plan, analysis.fireNumber])

  const simOptions = useMemo(
    () => simOptionsForPlan(inputs, analysis.retireAge, analysis.fireNumber, allocation.total > 0 ? allocation.sim : null),
    [inputs, analysis.retireAge, analysis.fireNumber, allocation],
  )

  const actualHistory = useMemo(
    () => investableHistory(netWorth?.breakdownHistory ?? [], inputs.includeCash, inputs.includeCrypto),
    [netWorth, inputs.includeCash, inputs.includeCrypto],
  )

  const spendingCosts = useMemo(
    () =>
      categoryCosts(trendMonths, new Date().toISOString().slice(0, 7), {
        investable: plan.investable,
        annualSpend: plan.annualSpend,
        annualContribution: plan.annualContribution,
        swr: plan.swr,
        realReturn: inputs.realReturn,
      }),
    [trendMonths, plan, inputs.realReturn],
  )

  return {
    inputs,
    update,
    baseline,
    plan,
    analysis,
    simOptions,
    accounts,
    allocation,
    cryptoStress,
    cryptoExamples: cryptoTiersQuery.data?.examples ?? null,
    actualHistory,
    spendingCosts,
    history: history.data ?? null,
    isLoading: inputsLoading || baselineLoading,
    isSaving,
  }
}

export type FirePlanState = ReturnType<typeof useFirePlan>

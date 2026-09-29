"use client"

import { useMemo } from "react"
import { useFireInputs } from "./use-fire-profile"
import { useFireBaseline, useFireHistoryData } from "./use-fire-baseline"
import { useFinanceAccounts } from "./use-accounts"
import { analyzePlan, simOptionsForPlan } from "@/lib/fire/fire-analysis"
import { resolvePlan } from "@/lib/fire/fire-plan"
import { buildAllocation, portfolioAccounts } from "@/lib/fire/fire-portfolio"
import { investableHistory, nowFractionalYear } from "@/lib/fire/fire-history"
import { categoryCosts } from "@/lib/fire/fire-spending-cost"

/** Everything the FIRE pages render from: inputs, baseline, plan, analysis, allocation, history. */
export function useFirePlan() {
  const { inputs, update, isLoading: inputsLoading, isSaving } = useFireInputs()
  const { baseline, netWorth, trendMonths, isLoading: baselineLoading } = useFireBaseline()
  const accountsQuery = useFinanceAccounts()
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
      }),
    [accounts, netWorth, inputs.accountMixes, inputs.includeCash, inputs.includeCrypto, inputs.cryptoTreatment, plan.annualSpend],
  )

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
    actualHistory,
    spendingCosts,
    history: history.data ?? null,
    isLoading: inputsLoading || baselineLoading,
    isSaving,
  }
}

export type FirePlanState = ReturnType<typeof useFirePlan>

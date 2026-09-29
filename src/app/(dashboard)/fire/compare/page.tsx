"use client"

import { useFirePlan } from "@/hooks/finance/use-fire-plan"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { CompareDetails } from "@/components/fire/compare/compare-details"
import { PeersCard } from "@/components/fire/compare/peers-card"
import { MillionaireCard } from "@/components/fire/compare/millionaire-card"
import { ZipIncomeCard } from "@/components/fire/compare/zip-income-card"
import { ProfessionCard } from "@/components/fire/compare/profession-card"

export default function FireComparePage() {
  const state = useFirePlan()
  const { isHidden } = usePrivacyMode()

  if (state.isLoading) {
    return <div className="space-y-5">{[0, 1, 2].map((i) => <div key={i} className="h-[180px] animate-shimmer rounded-2xl" />)}</div>
  }

  return (
    <div className="space-y-5">
      <CompareDetails state={state} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PeersCard state={state} isHidden={isHidden} />
        <MillionaireCard state={state} isHidden={isHidden} />
        <ZipIncomeCard state={state} isHidden={isHidden} />
        <ProfessionCard state={state} isHidden={isHidden} />
      </div>
      <p className="text-[11px] text-foreground-muted">
        Sources: Federal Reserve Survey of Consumer Finances 2022; U.S. Census Bureau American Community Survey 2019–2023; Bureau of
        Labor Statistics OEWS. Net worth compares by age, income and education because no public data reports wealth by zip code or
        profession.
      </p>
    </div>
  )
}

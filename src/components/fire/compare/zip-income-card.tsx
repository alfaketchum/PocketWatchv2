"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"
import { zipIncomePercentile } from "@/lib/fire/compare-income"
import { useZipData } from "@/hooks/finance/use-fire-compare"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireSectionCard } from "../fire-section-card"
import { householdIncomeOf } from "./compare-details"
import { PercentileBar, fmtShort } from "./percentile-bar"

/** Household income vs your zip code (Census ACS), plus local home value and rent. */
export function ZipIncomeCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const zip = state.inputs.compare.zip
  const income = householdIncomeOf(state)
  const { data, isLoading, isError } = useZipData(zip)

  const body = () => {
    if (!zip) return <p className="text-sm text-foreground-muted">Add your zip code under Your details.</p>
    if (isLoading) return <div className="h-[120px] animate-shimmer rounded-xl" />
    if (isError || !data) return <p className="text-sm text-foreground-muted">No Census data for {zip}.</p>
    const pct = income !== null ? zipIncomePercentile(data.bracketCounts, income) : null
    const priceToIncome = data.medianHomeValue && income ? data.medianHomeValue / income : null
    return (
      <>
        {pct !== null ? (
          <p className="text-sm text-foreground">
            Your household earns more than about <b>{Math.round(pct)}%</b> of households in {zip}
            {data.state ? `, ${data.state}` : ""}.
          </p>
        ) : (
          <p className="text-sm text-foreground-muted">Add your household income to see where you rank.</p>
        )}
        {pct !== null && (
          <PercentileBar
            percentile={pct}
            marks={data.medianIncome ? [{ p: 50, value: data.medianIncome }] : []}
            isHidden={isHidden}
          />
        )}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: "Median household income", value: data.medianIncome !== null ? fmtShort(data.medianIncome) : "—" },
            { label: "Median home value", value: data.medianHomeValue !== null ? fmtShort(data.medianHomeValue) : "—" },
            { label: "Median rent", value: data.medianRent !== null ? `${fmtShort(data.medianRent)}/mo` : "—" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] text-foreground-muted">{s.label}</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
        {priceToIncome !== null && (
          <p className="text-[11px] text-foreground-muted mt-3">
            A typical home here costs{" "}
            <BlurredValue isHidden={isHidden}><b className="text-foreground">{priceToIncome.toFixed(1)}×</b></BlurredValue> your household income.
          </p>
        )}
      </>
    )
  }

  return (
    <FireSectionCard
      eyebrow="Income vs. your zip"
      info="U.S. Census Bureau, American Community Survey 2019–2023 5-year estimates for your ZIP Code Tabulation Area, in 2023 dollars. Your zip is looked up on PocketWatch's server — it is not sent anywhere."
    >
      {body()}
    </FireSectionCard>
  )
}

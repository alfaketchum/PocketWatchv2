"use client"

import { useState } from "react"
import { comparePeersBy, type PeerDimension, type ScfData } from "@/lib/fire/scf-peers"
import scfJson from "@/lib/fire/data/scf-networth.json"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { ChoiceChips } from "../fire-input-controls"
import { FireSectionCard } from "../fire-section-card"
import { householdIncomeOf } from "./compare-details"
import { PercentileBar, fmtShort } from "./percentile-bar"

const SCF = scfJson as unknown as ScfData

const DIMENSIONS: { value: PeerDimension; label: string }[] = [
  { value: "age", label: "Age" },
  { value: "income", label: "Age + income" },
  { value: "education", label: "Age + education" },
]

function ageLabel([lo, hi]: [number, number]): string {
  return hi >= 120 ? `${lo}+` : lo === 0 ? `under ${hi + 1}` : `${lo}–${hi}`
}

/** Net worth percentile among US households (Fed SCF 2022) by age, age + income, or age + education. */
export function PeersCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const [dimension, setDimension] = useState<PeerDimension>("age")
  const { inputs, baseline } = state
  const netWorth = baseline.netWorth
  const result = comparePeersBy(SCF, {
    age: inputs.currentAge,
    netWorth,
    dimension,
    householdIncome: householdIncomeOf(state),
    education: inputs.compare.education,
  })

  const missing =
    (dimension === "income" && householdIncomeOf(state) === null) || (dimension === "education" && !inputs.compare.education)

  return (
    <FireSectionCard
      eyebrow="Net worth vs. peers"
      info={`${SCF.source}, ${SCF.dollars} dollars. The survey's net worth includes home equity and vehicles, which may not be in your PocketWatch total. Thin groups (under 40 surveyed households) fall back to age only.`}
      right={<ChoiceChips label="Compare by" options={DIMENSIONS} value={dimension} onChange={setDimension} />}
    >
      {!result ? (
        <p className="text-sm text-foreground-muted">Set your age on the FIRE Plan to compare.</p>
      ) : (
        <>
          <p className="text-sm text-foreground">
            {result.percentile >= 99 ? "Top 1%" : <>Ahead of about <b>{Math.round(result.percentile)}%</b></>} of US households aged{" "}
            {ageLabel(result.ages)}
            {result.groupLabel ? ` ${result.groupLabel}` : ""}{" "}
            <span className="text-foreground-muted">(median {fmtShort(result.median)})</span>
          </p>
          {missing && <p className="text-xs text-foreground-muted mt-1">Add your {dimension === "income" ? "household income" : "education"} under Your details — showing age only.</p>}
          {!missing && result.fellBack && <p className="text-xs text-foreground-muted mt-1">Too few surveyed households in that group — showing age only.</p>}
          <PercentileBar percentile={result.percentile} marks={result.marks} isHidden={isHidden} />
        </>
      )}
    </FireSectionCard>
  )
}

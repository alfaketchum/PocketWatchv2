"use client"

import { useMemo } from "react"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { crashAtRetirement, CRYPTO_PRESET_LABELS } from "@/lib/fire/crypto-stress"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney, fmtSuccess } from "./fire-helpers"

function fmtYears(years: number | null): string {
  if (years === null) return "never on this path"
  if (years <= 0) return "now"
  return `in ${years.toFixed(1)} years`
}

/**
 * Crypto stress inside the safety card. Basic: FI date with crypto at its risk-weighted value.
 * Advanced: ERN-style crash the month you retire, run through the historical simulation.
 */
export function FireCryptoStressLine({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { cryptoStress, inputs, history, simOptions, analysis, plan } = state
  const advanced = inputs.mode === "advanced"

  const crash = useMemo(() => {
    if (!advanced || !history || !cryptoStress) return null
    return crashAtRetirement(history, simOptions, analysis.fireNumber, plan.annualSpend, cryptoStress.lossFraction)
  }, [advanced, history, cryptoStress, simOptions, analysis.fireNumber, plan.annualSpend])

  if (!cryptoStress || cryptoStress.loss <= 0) return null
  const preset = CRYPTO_PRESET_LABELS[inputs.cryptoStressPreset].toLowerCase()
  const fullValue = cryptoStress.riskWeighted + cryptoStress.loss

  if (!advanced) {
    return (
      <p className="text-xs text-foreground mt-2">
        Counting your crypto at a risk-adjusted{" "}
        <BlurredValue isHidden={isHidden}>
          <span className="tabular-nums">{fmtCompact(cryptoStress.riskWeighted)} (vs {fmtCompact(fullValue)})</span>
        </BlurredValue>
        , you&apos;d retire {fmtYears(cryptoStress.stressedYears)} instead of {fmtYears(analysis.yourTarget.years).replace("in ", "")}.
      </p>
    )
  }

  if (!crash) return null
  return (
    <p className="text-xs text-foreground mt-2">
      If crypto crashes the month you retire ({preset}, −{Math.round(cryptoStress.lossFraction * 100)}% of your portfolio):{" "}
      <span className="font-semibold">{fmtSuccess(crash.successRate)} success</span>
      {crash.safeSpend !== null && (
        <>
          ,{" "}
          <BlurredValue isHidden={isHidden}>
            <span className="tabular-nums">{fmtMoney(crash.safeSpend)}/yr</span>
          </BlurredValue>{" "}
          safe spending
        </>
      )}
      .
    </p>
  )
}

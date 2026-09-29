"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { CRYPTO_TIERS, CRYPTO_TIER_LABELS, type CryptoTier } from "@/lib/fire/crypto-tiers"
import { CRYPTO_PRESET_LABELS } from "@/lib/fire/crypto-stress"
import type { CryptoStressPreset } from "@/lib/fire/fire-types"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

const PRESETS: Exclude<CryptoStressPreset, "custom">[] = ["cautious", "moderate", "full"]

const INFO =
  "Crypto has ~11 years of history, so it can't run through ERN's 1871+ simulation. Instead each tier is " +
  "stressed by a bad-case drop. Cautious ≈ worst drawdowns 2015–2026: BTC −83%, ETH −93%; coins that were " +
  "top-20 at the 2018 and 2021 peaks are down a median −77% and −93% since. ERN keeps crypto to a few % at most; " +
  "Damodaran: crypto can be priced, not valued."

/** Crypto by risk tier: value, stress drop, and what it counts for after the drop. */
export function CryptoRiskCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { cryptoStress, cryptoExamples, inputs, update } = state
  if (!inputs.includeCrypto) return null
  if (!cryptoStress) return <div className="h-[260px] animate-shimmer rounded-2xl" />

  const { tiers, drops } = cryptoStress
  const rows = CRYPTO_TIERS.filter((t) => tiers[t] > 0)
  const dropFor = (t: CryptoTier) => (t === "stable" ? 0 : drops[t])

  return (
    <FireSectionCard
      eyebrow="Crypto risk"
      title={
        <BlurredValue isHidden={isHidden}>
          <span>{fmtCompact(cryptoStress.riskWeighted + cryptoStress.loss)} counts as {fmtCompact(cryptoStress.riskWeighted)} after a bad-case crash</span>
        </BlurredValue>
      }
      info={INFO}
      right={
        <div role="radiogroup" aria-label="Crypto stress preset" className="inline-flex rounded-lg border border-card-border p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={inputs.cryptoStressPreset === p}
              onClick={() => update({ cryptoStressPreset: p })}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                inputs.cryptoStressPreset === p ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {CRYPTO_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      }
    >
      <ul className="divide-y divide-card-border/60">
        {rows.map((t) => {
          const drop = dropFor(t)
          return (
            <li key={t} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-foreground">{CRYPTO_TIER_LABELS[t]}</p>
                {cryptoExamples?.[t]?.length ? (
                  <p className="text-[11px] text-foreground-muted truncate">{cryptoExamples[t].join(", ")}</p>
                ) : null}
              </div>
              <BlurredValue isHidden={isHidden}>
                <span className="hidden sm:inline-block w-24 text-right tabular-nums text-foreground-muted">{fmtMoney(tiers[t])}</span>
              </BlurredValue>
              <span className={cn("w-14 text-right tabular-nums text-xs font-semibold", drop >= 0.85 ? "text-error" : drop > 0 ? "text-warning" : "text-foreground-muted")}>
                {drop > 0 ? `−${Math.round(drop * 100)}%` : "—"}
              </span>
              <BlurredValue isHidden={isHidden}>
                <span className="w-16 text-right tabular-nums font-semibold text-foreground">{fmtCompact(tiers[t] * (1 - drop))}</span>
              </BlurredValue>
            </li>
          )
        })}
      </ul>
      {inputs.cryptoStressPreset === "custom" && (
        <p className="text-[11px] text-foreground-muted mt-3">Using your custom drops from Advanced inputs.</p>
      )}
    </FireSectionCard>
  )
}

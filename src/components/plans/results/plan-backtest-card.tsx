"use client"

import { useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtCompact, fmtSuccess } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { useFireHistoryData } from "@/hooks/finance/use-fire-baseline"
import { backtestInput, planSuccessRate } from "@/lib/plans/plan-backtest"
import type { PlanDocument, PlanProjection } from "@/lib/plans/plan-types"

type Mix = "0.6" | "0.8" | "1"

const MIX_OPTIONS: { value: Mix; label: string }[] = [
  { value: "0.6", label: "60% stocks" },
  { value: "0.8", label: "80% stocks" },
  { value: "1", label: "100% stocks" },
]

const SAFE = 0.95
const SHAKY = 0.8

function verdict(rate: number): { text: string; tone: string } {
  if (rate >= SAFE) return { text: "Survives almost every historical market", tone: "text-success" }
  if (rate >= SHAKY) return { text: "Survives most historical markets, but not the worst ones", tone: "text-warning" }
  return { text: "Runs out of money in many historical markets", tone: "text-error" }
}

/** The plan's retirement spending replayed through every market since 1871. */
export function PlanBacktestCard({ doc, projection, isHidden }: { doc: PlanDocument; projection: PlanProjection; isHidden: boolean }) {
  const history = useFireHistoryData()
  const [mix, setMix] = useState<Mix>("0.8")
  const input = useMemo(() => backtestInput(doc, projection), [doc, projection])
  const rate = useMemo(
    () => (history.data && input ? planSuccessRate(history.data, input, Number(mix)) : null),
    [history.data, input, mix],
  )

  return (
    <FireSectionCard
      eyebrow="How safe is this plan?"
      info="Your retirement years' spending, taxes and income (as planned) replayed through every starting month since 1871 using real US stock and bond returns, instead of one steady return. Success = the money never runs out before the plan ends."
      right={input ? <ChoiceChips label="Portfolio mix" options={MIX_OPTIONS} value={mix} onChange={setMix} /> : undefined}
    >
      {!input ? (
        <p className="text-sm text-foreground-muted">
          Add a retirement milestone inside the plan, and some savings by then, to test it against market history.
        </p>
      ) : history.isLoading || rate === null ? (
        <div className="h-16 animate-shimmer rounded-xl" />
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className={`text-3xl font-semibold tabular-nums ${verdict(rate).tone}`}>{fmtSuccess(rate)}</p>
            <p className="text-[11px] text-foreground-muted">of historical retirements succeed</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${verdict(rate).tone}`}>{verdict(rate).text}</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Starting from <span style={isHidden ? { filter: "blur(6px)" } : undefined}>{fmtCompact(input.portfolio)}</span>{" "}
              (today&apos;s dollars) over {Math.round(input.horizonMonths / 12)} years of retirement.
            </p>
          </div>
        </div>
      )}
    </FireSectionCard>
  )
}

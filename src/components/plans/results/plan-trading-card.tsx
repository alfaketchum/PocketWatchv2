"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { cn } from "@/lib/utils"
import { compareTrading, tradingAccounts, type TradingComparison, type TradingOutcome } from "@/lib/plans/plan-trading-compare"
import type { PlanDocument } from "@/lib/plans/plan-types"

type Horizon = "10" | "20" | "end"

const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "10", label: "10 years" },
  { value: "20", label: "20 years" },
  { value: "end", label: "Plan end" },
]

const SLEEVE_LABELS: Record<number, string> = { 1: "Trade all", 0.5: "Trade half", 0.2: "Trade 20%", 0: "Buy & hold" }

/** The grid re-runs the whole plan a few dozen times, so wait for edits to settle. */
const COMPARE_DELAY_MS = 300

const pts = (edge: number) => `+${Math.round(edge * 1000) / 10} pts`

function Cell({ outcome, best }: { outcome: TradingOutcome; best: boolean }) {
  return (
    <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap", best && "bg-success/10")}>
      {outcome.runsOutAge !== null ? (
        <span className="text-error font-medium">Out at {outcome.runsOutAge}</span>
      ) : (
        <span className={cn(best ? "text-success font-semibold" : "text-foreground")}>{fmtCompact(outcome.endWealth)}</span>
      )}
      <span className="block text-[10px] text-foreground-muted">{fmtCompact(outcome.lifetimeTax)} tax</span>
    </td>
  )
}

function bestIndex(row: TradingOutcome[]): number {
  const score = (o: TradingOutcome) => (o.runsOutAge === null ? o.endWealth : -Infinity)
  return row.reduce((best, o, i) => (score(o) > score(row[best]) ? i : best), 0)
}

function Grid({ result, yourEdge, isHidden }: { result: TradingComparison; yourEdge: number | null; isHidden: boolean }) {
  return (
    <div className="overflow-x-auto -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
            <th className="px-3 py-2 font-semibold text-left whitespace-nowrap">Trading beats holding by</th>
            {result.sleeves.map((s) => (
              <th key={s} className="px-3 py-2 font-semibold text-right whitespace-nowrap">{SLEEVE_LABELS[s] ?? `${s * 100}%`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.edges.map((edge, i) => {
            const best = bestIndex(result.outcomes[i])
            return (
              <tr key={edge} className={cn("border-t border-card-border", edge === yourEdge && "font-medium")}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {pts(edge)}
                  {edge === yourEdge && <span className="ml-1.5 text-[10px] text-foreground-muted">yours</span>}
                </td>
                {result.outcomes[i].map((o, j) => <Cell key={result.sleeves[j]} outcome={o} best={j === best} />)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Trading vs buy and hold for the plan's actively traded accounts, across trading edges and sleeve sizes. */
export const PlanTradingCard = memo(function PlanTradingCard({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const [horizon, setHorizon] = useState<Horizon>("10")
  const [yourEdge, setYourEdge] = useState<number | null>(null)
  const hasTrading = useMemo(() => tradingAccounts(doc).length > 0, [doc])
  const [result, setResult] = useState<TradingComparison | null>(null)
  useEffect(() => {
    if (!hasTrading) return
    const years = horizon === "end" ? null : Number(horizon)
    const timer = setTimeout(() => setResult(compareTrading(doc, yourEdge, years)), COMPARE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [doc, hasTrading, horizon, yourEdge])

  if (!hasTrading) return null
  const breakEven = result?.breakEvenEdge
  return (
    <FireSectionCard
      eyebrow="Is trading worth it?"
      info="Each traded account is split into a traded part and a held part. The traded part earns the account's return plus the edge before tax, and its gains are taxed every year as set on the account (realized share, short-term share). The held part earns the account's return and is only taxed when withdrawn. Spending comes from the traded part first. Amounts are accounts at the horizon in today's dollars; the small line is total tax paid. Big edges rarely last, and they usually shrink as the money grows, so read the shorter horizons too."
      right={<ChoiceChips label="Horizon" options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <p className="text-sm text-foreground max-w-xl">
          {result === null ? (
            "Comparing…"
          ) : breakEven === null || breakEven === undefined ? (
            "Trading everything never catches up with buy and hold here, even at a 200-point edge."
          ) : (
            <>
              Trading everything pays off only if it beats buy and hold by more than{" "}
              <b className="tabular-nums">{pts(breakEven)}</b> a year before tax. Below that, taxes eat the edge.
            </>
          )}
        </p>
        <div className="w-44">
          <FireNumberField
            label="Your edge / yr"
            suffix="pts"
            scale={100}
            min={0}
            max={5}
            value={yourEdge ?? 0}
            hint="Extra return over holding, before tax"
            onChange={(v) => setYourEdge(v > 0 ? v : null)}
          />
        </div>
      </div>
      {result === null ? <div className="h-64 animate-shimmer rounded-xl" /> : <Grid result={result} yourEdge={yourEdge} isHidden={isHidden} />}
    </FireSectionCard>
  )
})

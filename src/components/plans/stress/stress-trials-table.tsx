"use client"

import { useMemo, useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { sequenceLabel, trialId, trialName, trialStatus, TRIAL_TONE_CLASS } from "@/lib/plans/stress/stress-labels"
import { endingValue } from "@/lib/plans/stress/stress-histogram"
import { bucketOf, type OutcomeKey, type OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"
import { useOutcomeColors } from "./use-outcome-colors"

const PAGE = 25
const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  surplus: "Surplus",
  steady: "Steady",
  justMadeIt: "Just made it",
  soldHome: "Sold the home",
  outOfCash: "Out of cash",
  almostSurvived: "Almost survived",
  catastrophic: "Catastrophic",
}

/** Worst first: net worth hitting $0 earliest, then the cash running out earliest, then the lowest ending net worth. */
function worstFirst(a: CohortResult, b: CohortResult): number {
  const broke = (c: CohortResult) => c.brokeAge ?? Infinity
  const ranOut = (c: CohortResult) => c.depletedAge ?? Infinity
  return broke(a) - broke(b) || ranOut(a) - ranOut(b) || endingValue(a, "netWorth") - endingValue(b, "netWorth")
}

interface Props {
  cohorts: CohortResult[]
  yardsticks: OutcomeYardsticks
  /** Plan year of retirement, for the "at retirement" column (none without one). */
  retirementIndex: number | null
  isHidden: boolean
}

/** Every trial, worst first: the years it lived through, net worth at retirement and at the end, and its outcome. */
export function StressTrialsTable({ cohorts, yardsticks, retirementIndex, isHidden }: Props) {
  const [shown, setShown] = useState(PAGE)
  const colors = useOutcomeColors()
  const sorted = useMemo(() => [...cohorts].sort(worstFirst), [cohorts])
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const atRetirement = retirementIndex !== null && retirementIndex > 0
  const anySales = cohorts.some((c) => c.homeSales)
  return (
    <div className="space-y-2">
      <div className="scroll-hint overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="py-1.5 font-semibold">Trial</th>
              <th className="hidden py-1.5 pl-3 font-semibold sm:table-cell">Years it lived through</th>
              {atRetirement && <th className="py-1.5 pl-2 text-right font-semibold">At retirement</th>}
              <th className="py-1.5 pl-2 text-right font-semibold" title="Accounts plus home and other property, minus debts">Ending net worth</th>
              <th className="py-1.5 pl-2 text-right font-semibold" title="Money left in your accounts at the end: what pays the bills">Ending in accounts</th>
              {anySales && <th className="py-1.5 pl-3 font-semibold" title="Homes sold in this trial, and at what age: by your plan, or by the stress test because the money ran out">Home sold</th>}
              <th className="py-1.5 pl-3 font-semibold">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, shown).map((c) => {
              const outcome = bucketOf(c, yardsticks)
              return (
                <tr key={trialId(c)} className="border-t border-card-border align-top">
                  <td className="whitespace-nowrap py-1.5 text-foreground">{trialName(c)}</td>
                  <td className="hidden py-1.5 pl-3 text-foreground-muted sm:table-cell">{sequenceLabel(c.sequence)}</td>
                  {atRetirement && (
                    <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground" style={blur}>
                      {fmtMoney(c.netWorth[retirementIndex] ?? 0)}
                    </td>
                  )}
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground" style={blur}>
                    {fmtMoney(endingValue(c, "netWorth"))}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right font-data text-foreground-muted" style={blur}>
                    {fmtMoney(endingValue(c, "invested"))}
                  </td>
                  {anySales && (
                    <td className="py-1.5 pl-3 text-foreground-muted">
                      {c.homeSales?.map((s) => (
                        <span key={`${s.name}-${s.age}`} className="block whitespace-nowrap">
                          {s.name} at {s.age}
                          {s.planned ? (s.plannedAge !== undefined ? ` (plan had ${s.plannedAge})` : " (plan)") : ""}
                        </span>
                      )) ?? "—"}
                    </td>
                  )}
                  <td className="whitespace-nowrap py-1.5 pl-3 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: colors[outcome] }} aria-hidden="true" />
                      {OUTCOME_LABELS[outcome]}
                      {trialStatus(c).tone !== "ok" && <span className={TRIAL_TONE_CLASS[trialStatus(c).tone]}>· {trialStatus(c).text.replace(/^./, (x) => x.toLowerCase())}</span>}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[11px] text-foreground-muted">
        <span>
          Showing {Math.min(shown, sorted.length)} of {sorted.length}, worst first
        </span>
        {shown < sorted.length && (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setShown((n) => n + PAGE * 4)}>
            Show more
          </button>
        )}
      </div>
    </div>
  )
}

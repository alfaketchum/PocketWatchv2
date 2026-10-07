"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtCompact, fmtSuccess } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { SolverKey, SolverResult, StressGoal } from "@/lib/plans/stress/stress-solvers"
import { fixAnchor } from "./stress-diagnosis-card"
import { Bar, Delta } from "./stress-impacts-table"
import type { SolverRow } from "./use-stress-solvers"

export const TARGETS = [0.8, 0.85, 0.9, 0.95] as const
const TARGET_OPTIONS = TARGETS.map((t) => ({ value: String(t), label: `${Math.round(t * 100)}%` }))

const LEVERS: Record<SolverKey, string> = {
  spending: "Everyday spending",
  mix: "Investment mix",
  retirement: "Retirement age",
  socialSecurity: "Social Security",
}

const INFO =
  "Each lever moved on its own until your plan meets the goal in the target share of trials, on the same simulated markets as What would help. Goal: Fully funded (your accounts fund every year's spending, the stricter one) or Solvent (assets never exhausted: net worth never falls below one year of spending after the accounts are depleted). Everyday spending is what you entered yourself (not kids, home and car costs, or one-time items); the mix goes to every invested account (not cash or 529s) and is what the stress test replays, while your assumed returns stay as they are. Apply makes the change in your plan, with Undo."

const money = (v: number | string) => (typeof v === "number" ? `${fmtCompact(v)} a year` : v)

/** The answer in words, by solver and outcome. */
function answer(r: SolverResult, target: number): string {
  const goal = fmtSuccess(target)
  const best = `best ${fmtSuccess(r.successRate)}`
  switch (r.key) {
    case "spending":
      if (r.status === "found") return `Spend up to ${money(r.value)} (now ${money(r.now)})`
      if (r.status === "alreadyMet") return `You could spend up to ${money(r.value)} (now ${money(r.now)})`
      return `Can't reach ${goal} alone: even ${money(r.value)} is ${best}`
    case "mix":
      if (r.status === "alreadyMet") return "Today's mix already gets there"
      if (r.status === "found") return `Invest ${r.value}`
      return `Can't reach ${goal} alone: ${best} with ${r.value}`
    case "retirement":
      if (r.status === "found") return `Retire at ${r.value} (now ${r.now})`
      if (r.status === "alreadyMet") return `You could retire at ${r.value} (now ${r.now})`
      return `Can't reach ${goal} alone: retiring at ${r.value} is ${best}`
    case "socialSecurity":
      if (r.value === r.now) return `Claiming at ${r.now} is already best`
      if (r.status === "unreachable") return `Can't reach ${goal} alone: claiming at ${r.value} is ${best}`
      return `Claim at ${r.value} (now ${r.now})`
  }
}

/** What Apply did, for its Undo toast. */
export function changeLabel(r: SolverResult): string {
  if (r.change.kind === "spending") return `everyday spending to ${money(r.value)}`
  if (r.change.kind === "mix") return `invest ${r.change.label.toLowerCase()}`
  if (r.change.kind === "retirement") return `retire at ${r.change.age}`
  return `claim Social Security at ${r.change.age}`
}

/** Nothing to apply when the answer is the plan as it is. */
const changes = (r: SolverResult) => r.value !== r.now && !(r.key === "mix" && r.status === "alreadyMet")

const GOAL_OPTIONS: { value: StressGoal; label: string }[] = [
  { value: "cash", label: "Fully funded" },
  { value: "netWorth", label: "Solvent" },
]

interface Props {
  rows: SolverRow[]
  target: number
  onTarget: (t: number) => void
  goal: StressGoal
  onGoal: (g: StressGoal) => void
  onApply: (r: SolverResult) => void
}

/** "Reach your target": how far each lever must move for the plan to last in the target share of trials. */
export function StressSolversCard({ rows, target, onTarget, goal, onGoal, onApply }: Props) {
  if (rows.length === 0) return null
  return (
    <FireSectionCard
      eyebrow="Reach your target"
      title="How far each lever has to move"
      info={INFO}
      right={
        <div className="flex flex-wrap items-center gap-3">
          <ChoiceChips label="Goal" options={GOAL_OPTIONS} value={goal} onChange={onGoal} />
          <ChoiceChips label="Target success rate" options={TARGET_OPTIONS} value={String(target)} onChange={(v) => onTarget(Number(v))} />
        </div>
      }
    >
      <ul className="divide-y divide-card-border/60">
        {rows.map((row) => (
          <li key={row.key} id={fixAnchor(row.key)} className="grid scroll-mt-24 gap-2 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center">
            <div className="min-w-0">
              <p className="label-caps">{LEVERS[row.key]}</p>
              {row.result ? (
                <p className="text-sm text-foreground">{answer(row.result, target)}</p>
              ) : (
                <div className="mt-1 h-4 w-3/4 animate-shimmer rounded" aria-label={`Solving, ${row.steps} tried`} />
              )}
            </div>
            {row.result && (
              <div className="flex items-center gap-2">
                <Bar rate={row.result.successRate} baseline={false} />
                <span className="w-10 shrink-0 text-right font-data text-xs text-foreground">{fmtSuccess(row.result.successRate)}</span>
                <span className="w-14 shrink-0 text-right font-data text-xs">
                  <Delta points={(row.result.successRate - row.result.baselineRate) * 100} />
                </span>
              </div>
            )}
            <div className="sm:text-right">
              {row.result && changes(row.result) && (
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onApply(row.result!)}>
                  Apply
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </FireSectionCard>
  )
}

"use client"

import { useMemo, useState } from "react"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { HoverHint } from "@/components/ui/hover-hint"
import { fmtTrialShare, sequenceLabel, trialId, trialName, trialStatus, TRIAL_TONE_CLASS } from "@/lib/plans/stress/stress-labels"
import { endingValue } from "@/lib/plans/stress/stress-histogram"
import { bucketOf, outcomeBuckets, type OutcomeKey, type OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import { percentile, type CohortResult } from "@/lib/plans/stress/stress-test"
import { StressPathsChart } from "./stress-paths-chart"
import { useOutcomeColors } from "./use-outcome-colors"

/** Worst outcomes first: those are the trials worth reading. */
const ORDER: OutcomeKey[] = ["catastrophic", "almostSurvived", "outOfCash", "soldHome", "justMadeIt", "steady", "surplus"]
/** Rows a group shows before "Show more", and how many more each click adds. */
const FIRST_ROWS = 8
const MORE_ROWS = 25
const SPARK_W = 72
const SPARK_H = 20

/** Worst first within a group: going broke earliest, then the cash running out earliest, then the lowest ending. */
function worstFirst(a: CohortResult, b: CohortResult): number {
  const broke = (c: CohortResult) => c.brokeAge ?? Infinity
  const ranOut = (c: CohortResult) => c.depletedAge ?? Infinity
  return broke(a) - broke(b) || ranOut(a) - ranOut(b) || endingValue(a, "netWorth") - endingValue(b, "netWorth")
}

/** A trial's net worth by age as a tiny line, on one scale for every trial so they compare at a glance. */
function Spark({ values, top, color }: { values: number[]; top: number; color: string }) {
  const n = Math.max(1, values.length - 1)
  const points = values.map((v, i) => `${((i / n) * SPARK_W).toFixed(1)},${(SPARK_H - (Math.max(0, Math.min(v, top)) / top) * SPARK_H).toFixed(1)}`).join(" ")
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  )
}

interface RowProps {
  c: CohortResult
  top: number
  color: string
  open: boolean
  onToggle: () => void
  detail: { age0: number; plan: number[] }
  isHidden: boolean
}

function TrialRow({ c, top, color, open, onToggle, detail, isHidden }: RowProps) {
  const status = trialStatus(c)
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const sales = c.homeSales?.map((s) => `${s.name} sold at ${s.age}${s.plannedAge !== undefined ? ` (plan had ${s.plannedAge})` : s.planned ? " (plan)" : ""}`)
  return (
    <li className="border-t border-card-border first:border-t-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 py-2 text-left text-xs hover:bg-row-hover">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }} aria-hidden="true">
          {open ? "expand_less" : "expand_more"}
        </span>
        <span style={blur}>
          <Spark values={c.netWorth} top={top} color={color} />
        </span>
        <span className="w-24 shrink-0 truncate font-medium text-foreground">{trialName(c)}</span>
        <span className={`w-40 shrink-0 truncate ${TRIAL_TONE_CLASS[status.tone]}`}>{status.tone === "ok" ? "Fully funded" : status.text}</span>
        <span className="hidden min-w-0 flex-1 truncate text-foreground-muted md:inline">{sales?.join(" · ") ?? sequenceLabel(c.sequence, 3)}</span>
        <span className="ml-auto w-20 shrink-0 text-right font-data text-foreground" style={blur} title="Net worth at the end, today's dollars">
          {fmtCompact(endingValue(c, "netWorth"))}
        </span>
      </button>
      {open && (
        <div className="space-y-2 pb-3 pl-7">
          <p className="text-[11px] text-foreground-muted">
            Lived through {sequenceLabel(c.sequence)}. Ends with {fmtCompact(endingValue(c, "netWorth"))} of net worth, {fmtCompact(endingValue(c, "invested"))} of it in accounts.
            {sales ? ` ${sales.join("; ")}.` : ""}
          </p>
          <StressPathsChart cohorts={[c]} age0={detail.age0} plan={detail.plan} measure="netWorth" isHidden={isHidden} />
        </div>
      )}
    </li>
  )
}

interface Props {
  cohorts: CohortResult[]
  yardsticks: OutcomeYardsticks
  /** For a trial's own chart: the first age and the steady plan's net worth by year (today's dollars). */
  age0: number
  planNetWorth: number[]
  isHidden: boolean
}

/**
 * Every trial, grouped by how it ended (worst groups first, each with its count, share and rule) and filterable to
 * one group. Each row shows the trial's net worth as a tiny line; open it for its full path against your plan.
 */
export function StressTrialsGroups({ cohorts, yardsticks, age0, planNetWorth, isHidden }: Props) {
  const colors = useOutcomeColors()
  const [only, setOnly] = useState<OutcomeKey | null>(null)
  const [openTrial, setOpenTrial] = useState<number | null>(null)
  const [shown, setShown] = useState<Partial<Record<OutcomeKey, number>>>({})
  const groups = useMemo(() => {
    const rules = new Map(outcomeBuckets(cohorts, yardsticks).map((b) => [b.key, b]))
    const by = new Map<OutcomeKey, CohortResult[]>()
    for (const c of cohorts) {
      const key = bucketOf(c, yardsticks)
      by.set(key, [...(by.get(key) ?? []), c])
    }
    return ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, label: rules.get(k)!.label, rule: rules.get(k)!.rule, trials: by.get(k)!.sort(worstFirst) }))
  }, [cohorts, yardsticks])
  // One scale for every sparkline: the 90th percentile of the trials' highest net worth.
  const top = useMemo(() => Math.max(1, percentile(cohorts.map((c) => Math.max(...c.netWorth)), 0.9)), [cohorts])
  const visible = only ? groups.filter((g) => g.key === only) : groups
  const total = cohorts.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Show trials that">
        {[{ key: null, label: "All", count: total }, ...groups.map((g) => ({ key: g.key, label: g.label, count: g.trials.length, rule: g.rule }))].map((chip) => {
          const active = only === chip.key
          return (
            <HoverHint key={chip.key ?? "all"} hint={"rule" in chip ? chip.rule : undefined}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setOnly(chip.key)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors md:min-h-0 ${active ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground"}`}
              >
                {chip.key && <span className="h-2 w-2 rounded-[2px]" style={{ background: colors[chip.key] }} aria-hidden="true" />}
                {chip.label}
                <span className="font-data tabular-nums opacity-70">{chip.count.toLocaleString()}</span>
              </button>
            </HoverHint>
          )
        })}
      </div>
      {visible.map((g) => {
        const limit = shown[g.key] ?? (only ? MORE_ROWS : FIRST_ROWS)
        return (
          <section key={g.key} className="rounded-xl border border-card-border">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-card-border bg-background-secondary/40 px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 self-center rounded-[3px]" style={{ background: colors[g.key] }} aria-hidden="true" />
              <h4 className="text-sm font-semibold text-foreground">{g.label}</h4>
              <span className="font-data text-xs tabular-nums text-foreground-muted">
                {g.trials.length.toLocaleString()} · {fmtTrialShare(g.trials.length / Math.max(1, total))}
              </span>
              <span className="basis-full text-[11px] text-foreground-muted sm:basis-auto">{g.rule}</span>
            </header>
            <ul className="px-3">
              {g.trials.slice(0, limit).map((c) => (
                <TrialRow
                  key={trialId(c)}
                  c={c}
                  top={top}
                  color={colors[g.key]}
                  open={openTrial === trialId(c)}
                  onToggle={() => setOpenTrial((t) => (t === trialId(c) ? null : trialId(c)))}
                  detail={{ age0, plan: planNetWorth }}
                  isHidden={isHidden}
                />
              ))}
            </ul>
            {g.trials.length > limit && (
              <button type="button" onClick={() => setShown((s) => ({ ...s, [g.key]: limit + MORE_ROWS }))} className="btn-ghost w-full border-t border-card-border py-2 text-xs">
                Show {Math.min(MORE_ROWS, g.trials.length - limit).toLocaleString()} more of {g.trials.length.toLocaleString()}
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}

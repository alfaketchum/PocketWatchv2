"use client"

import { fmtSuccess } from "@/components/fire/fire-helpers"
import type { ImpactResult } from "@/lib/plans/stress/stress-impacts"
import { BASELINE_KEY } from "./use-stress-impacts"

/** A change this many points either way reads as no real difference (the trials are a sample). */
const NOISE_POINTS = 1

function Delta({ points }: { points: number }) {
  if (Math.abs(points) < NOISE_POINTS) return <span className="text-foreground-muted">±0</span>
  return <span className={points > 0 ? "text-success" : "text-error"}>{`${points > 0 ? "+" : "−"}${Math.round(Math.abs(points))} pts`}</span>
}

/** One bar per run: how often the money lasted, the plan as it is in the accent, the changes muted. */
function Bar({ rate, baseline }: { rate: number; baseline: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-background-secondary">
      <div className={baseline ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-primary/45"} style={{ width: `${Math.round(rate * 100)}%` }} />
    </div>
  )
}

interface Props {
  results: ImpactResult[]
  total: number
  unit: string
  sampleSize: number
}

/** The plan and each one-change what-if, most helpful first: how often the money lasts and the typical run-out age. */
export function StressImpactsTable({ results, total, unit, sampleSize }: Props) {
  const baseline = results.find((r) => r.key === BASELINE_KEY)
  const rows = [...results].sort((a, b) => (a.key === BASELINE_KEY ? -1 : b.key === BASELINE_KEY ? 1 : b.successRate - a.successRate))
  const pending = total - results.length
  return (
    <div className="space-y-2">
      <div className="scroll-hint overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="py-1.5 font-semibold">Change</th>
              <th className="w-[38%] py-1.5 pl-3 font-semibold">Money lasts</th>
              <th className="py-1.5 pl-2 text-right font-semibold">vs now</th>
              <th className="py-1.5 pl-3 text-right font-semibold" title="The typical age the money ran out, in the trials that ran out">Runs out at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBase = r.key === BASELINE_KEY
              return (
                <tr key={r.key} className="border-t border-card-border">
                  <td className={`py-2 pr-2 ${isBase ? "font-semibold text-foreground" : "text-foreground"}`}>{r.label}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <Bar rate={r.successRate} baseline={isBase} />
                      <span className="w-10 shrink-0 text-right font-data text-foreground">{fmtSuccess(r.successRate)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right font-data">{isBase || !baseline ? "" : <Delta points={(r.successRate - baseline.successRate) * 100} />}</td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right font-data text-foreground-muted">{r.medianRunOutAge ?? "—"}</td>
                </tr>
              )
            })}
            {pending > 0 && (
              <tr className="border-t border-card-border">
                <td colSpan={4} className="py-2">
                  <div className="h-4 animate-shimmer rounded" aria-label={`Trying ${pending} more change${pending === 1 ? "" : "s"}`} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-muted">
        Each change tried on its own, on the same {sampleSize.toLocaleString()} {unit}; your plan isn&apos;t changed.
      </p>
    </div>
  )
}

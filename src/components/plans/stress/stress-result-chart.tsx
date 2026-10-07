"use client"

import { InfoTooltip } from "@/components/ui/info-tooltip"
import type { SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import { SegmentedToggle } from "../results/plan-chart-controls"
import { METHOD_INFO, METHOD_OPTIONS } from "./stress-controls"

interface Props {
  sampling: SamplingOptions
  onSampling: (s: SamplingOptions) => void
  /** How many runs the chart holds, once there are results: "1,000 trials" or "125 start years". */
  size: string | null
}

/**
 * The result chart's header, like the plan chart's: the way trials are drawn as a switch on the chart itself (it
 * re-runs and replays), the run's size, and Reroll for the simulated methods.
 */
export function StressChartHeader({ sampling, onSampling, size }: Props) {
  const simulated = sampling.method !== "history"
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-1">
        <SegmentedToggle label="How trials are drawn" value={sampling.method} onChange={(method) => onSampling({ ...sampling, method })} options={METHOD_OPTIONS} />
        <InfoTooltip content={METHOD_INFO} />
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        {size && <span className="font-data tabular-nums">{size}</span>}
        {simulated && (
          <button type="button" className="btn-ghost inline-flex min-h-9 items-center gap-1 px-2 py-1 text-xs md:min-h-0" onClick={() => onSampling({ ...sampling, seed: sampling.seed + 1 })} title="Draw a new set of markets">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              casino
            </span>
            Reroll
          </button>
        )}
      </div>
    </div>
  )
}

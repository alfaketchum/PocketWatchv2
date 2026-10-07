"use client"

import type { ReactNode } from "react"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import type { SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import { SegmentedToggle } from "../results/plan-chart-controls"
import { METHOD_INFO, METHOD_OPTIONS } from "./stress-controls"

interface Props {
  sampling: SamplingOptions
  onSampling: (s: SamplingOptions) => void
  /** How many runs the chart holds, once there are results: "500 trials" or "125 start years". */
  size: string | null
  /** The settings or the plan changed since the run on screen. */
  stale: boolean
  /** The Run simulation button. */
  action: ReactNode
}

/**
 * The result chart's header, like the plan chart's: the way trials are drawn as a switch on the chart itself, the
 * run's size (or that it's out of date), and Run simulation.
 */
export function StressChartHeader({ sampling, onSampling, size, stale, action }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-1">
        <SegmentedToggle label="How trials are drawn" value={sampling.method} onChange={(method) => onSampling({ ...sampling, method })} options={METHOD_OPTIONS} />
        <InfoTooltip content={METHOD_INFO} />
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        {stale ? <span className="text-warning">Changed since this run</span> : size && <span className="font-data tabular-nums">{size}</span>}
        {action}
      </div>
    </div>
  )
}

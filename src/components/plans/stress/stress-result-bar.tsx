"use client"

import type { ReactNode } from "react"
import type { SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { StressInflation } from "@/lib/plans/stress/stress-test"
import type { Cape } from "./stress-controls"

/** The settings in one line: "1,000 simulated markets · 10-year blocks · any valuation · plan's inflation". */
export function settingsLine(sampling: SamplingOptions, cape: Cape, inflation: StressInflation): string {
  const runs =
    sampling.method === "history"
      ? "Every start year since 1871"
      : `${sampling.trials.toLocaleString()} ${sampling.method === "block" ? "simulated markets" : sampling.method === "restart" ? "runs (random restart)" : "runs (random years)"}`
  const blocks = sampling.method === "block" ? `${sampling.blockLength}-year blocks` : null
  const valuation = cape === "all" ? "any valuation" : `CAPE ≥ ${cape}`
  return [runs, blocks, valuation, inflation === "plan" ? "plan's inflation" : "historical inflation"].filter(Boolean).join(" · ")
}

interface Props {
  /** The chart's header: the method switch, the run's size, Reroll. */
  header: ReactNode
  /** The chart and the headline under it (or a placeholder while it loads). */
  children: ReactNode
  settings: string
  onChangeSettings: () => void
  /** The histogram bar filter in force, and how to clear it. */
  filter: string | null
  onClearFilter: () => void
}

/**
 * Above every tab, like the plan's chart card: the method switch on top, the run's chart and the result under it,
 * then the rest of the settings with a way to change them, and any bar filter in force.
 */
export function StressResultBar({ header, children, settings, onChangeSettings, filter, onClearFilter }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-card-border bg-card p-5 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
      {header}
      {children}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-foreground-muted">
        <span>{settings}</span>
        <button type="button" onClick={onChangeSettings} className="font-medium text-primary hover:underline">
          Change
        </button>
        {filter && (
          <button type="button" onClick={onClearFilter} className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-2.5 py-1 font-medium text-primary">
            {filter}
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              close
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

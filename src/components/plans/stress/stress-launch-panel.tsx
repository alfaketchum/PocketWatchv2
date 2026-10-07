"use client"

import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { BLOCK_OPTIONS, TRIAL_OPTIONS, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { StressInflation } from "@/lib/plans/stress/stress-test"
import { MENU_COLLISION_PADDING, MENU_PANEL } from "../editor/chip-menu"
import { SegmentedToggle } from "../results/plan-chart-controls"
import { METHOD_OPTIONS, Setting } from "./stress-controls"

const trialOptions = TRIAL_OPTIONS.map((n) => ({ value: String(n), label: n.toLocaleString() }))
const blockOptions = BLOCK_OPTIONS.map((n) => ({ value: String(n), label: `${n} yrs` }))
const INFLATION_OPTIONS: { value: StressInflation; label: string }[] = [
  { value: "plan", label: "Plan's rate" },
  { value: "history", label: "Historical" },
]

interface Props {
  sampling: SamplingOptions
  onSampling: (s: SamplingOptions) => void
  inflation: StressInflation
  onInflation: (i: StressInflation) => void
  /** Runs the simulation with these settings. */
  onRun: () => void
  /** Opens the Setup tab for everything else (valuation, lining history up, homes, account mixes). */
  onMore: () => void
}

/** What a run will be, in words: "500 simulated markets, 10-year blocks of history since 1871". */
function runLine(s: SamplingOptions): string {
  if (s.method === "history") return "Your plan once for every start year since 1871"
  const n = s.trials.toLocaleString()
  if (s.method === "block") return `${n} simulated markets, built from ${s.blockLength}-year runs of history since 1871`
  return s.method === "restart" ? `${n} runs through history, restarting at a random year when it runs out` : `${n} runs with a random historical year for each year`
}

/** The settings a run needs, and the button that starts it: inline before the first run, in a pop-out after. */
export function StressLaunchPanel({ sampling, onSampling, inflation, onInflation, onRun, onMore }: Props) {
  const set = (patch: Partial<SamplingOptions>) => onSampling({ ...sampling, ...patch })
  const simulated = sampling.method !== "history"
  return (
    <div className="space-y-3">
      <Setting label="Method">
        <SegmentedToggle label="How trials are drawn" value={sampling.method} onChange={(method) => set({ method })} options={METHOD_OPTIONS} />
      </Setting>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {simulated && (
          <Setting label="Trials">
            <ChoiceChips label="Trials" options={trialOptions} value={String(sampling.trials)} onChange={(v) => set({ trials: Number(v) })} />
          </Setting>
        )}
        {sampling.method === "block" && (
          <Setting label="Block length">
            <ChoiceChips label="Block length" options={blockOptions} value={String(sampling.blockLength)} onChange={(v) => set({ blockLength: Number(v) })} />
          </Setting>
        )}
        <Setting label="Inflation">
          <ChoiceChips label="Inflation" options={INFLATION_OPTIONS} value={inflation} onChange={onInflation} />
        </Setting>
      </div>
      <p className="text-xs text-foreground-muted">{runLine(sampling)}.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onRun} className="btn-primary inline-flex min-h-11 items-center gap-1.5 px-4 py-2 text-sm md:min-h-0">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
            play_arrow
          </span>
          Run simulation
        </button>
        {simulated && (
          <button type="button" onClick={() => set({ seed: sampling.seed + 1 })} className="btn-ghost inline-flex min-h-11 items-center gap-1 px-2 py-1 text-xs md:min-h-0" title="Draw a new set of markets for the next run">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              casino
            </span>
            New markets
          </button>
        )}
        <button type="button" onClick={onMore} className="ml-auto text-xs font-medium text-primary hover:underline">
          More settings
        </button>
      </div>
    </div>
  )
}

/** The chart header's "Run simulation" button: opens the launch panel as a pop-out; running closes it. */
export function StressRunButton({ stale, ...panel }: Props & { stale: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={`${stale ? "btn-primary" : "btn-secondary"} inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs md:min-h-0`}>
          <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">
            play_arrow
          </span>
          Run simulation
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={MENU_COLLISION_PADDING} className={`${MENU_PANEL} w-[min(30rem,calc(100vw-16px))] p-4`}>
          <StressLaunchPanel
            {...panel}
            onRun={() => {
              setOpen(false)
              panel.onRun()
            }}
            onMore={() => {
              setOpen(false)
              panel.onMore()
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

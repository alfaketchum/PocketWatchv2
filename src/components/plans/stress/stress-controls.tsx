"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { BLOCK_OPTIONS, TRIAL_OPTIONS, type SamplingOptions, type StressSampling } from "@/lib/plans/stress/stress-sampling"
import type { StressAlign, StressInflation } from "@/lib/plans/stress/stress-test"

export type Cape = "all" | "20" | "30"

const METHOD_OPTIONS: { value: StressSampling; label: string }[] = [
  { value: "block", label: "Simulated" },
  { value: "history", label: "History" },
  { value: "restart", label: "Random restart" },
  { value: "random", label: "Random years" },
]
const METHOD_INFO =
  "Simulated (block bootstrap): each trial stitches together random runs of consecutive historical years, so crashes, recoveries and inflation streaks stay intact while eras mix; it covers today's start too, which history can't. History: your plan once per complete start year since 1871, exactly as it happened. Random restart: each start year in order, jumping to a random year whenever history runs out (ProjectionLab's default). Random years: a random year for every year of the plan, which breaks up streaks and usually looks rosier. Every trial keeps a year's stocks, bonds, inflation and valuation together. A fixed seed keeps the numbers steady; Reroll draws a new set."
const ALIGN_OPTIONS: { value: StressAlign; label: string }[] = [
  { value: "start", label: "From today" },
  { value: "retirement", label: "From retirement" },
]
const INFLATION_OPTIONS: { value: StressInflation; label: string }[] = [
  { value: "plan", label: "Plan's assumption" },
  { value: "history", label: "What actually happened" },
]
const INFLATION_INFO =
  "The historical returns already have each year's real inflation taken out, so for anything that rises with prices the inflation rate cancels. \"What actually happened\" also runs each year through its real inflation (official CPI, from 1913): pensions without raises lose buying power faster in the 1970s, fixed loan payments get cheaper, and tax lines fixed in dollars catch more income. Earlier years keep the plan's rate."
const CAPE_OPTIONS: { value: Cape; label: string }[] = [
  { value: "all", label: "All" },
  { value: "20", label: "CAPE ≥ 20" },
  { value: "30", label: "CAPE ≥ 30" },
]
const capeInfo = (latest: number | null) =>
  `Only starts in expensive markets (CAPE: price over ten years of earnings).${latest !== null ? ` Today's CAPE is ${latest.toFixed(1)}; high readings have historically come before weaker returns.` : ""}`
const trialOptions = TRIAL_OPTIONS.map((n) => ({ value: String(n), label: n.toLocaleString() }))
const blockOptions = BLOCK_OPTIONS.map((n) => ({ value: String(n), label: `${n} yrs` }))

interface Props {
  sampling: SamplingOptions
  onSampling: (s: SamplingOptions) => void
  align: StressAlign
  onAlign: (a: StressAlign) => void
  canAlignRetirement: boolean
  cape: Cape
  onCape: (c: Cape) => void
  inflation: StressInflation
  onInflation: (i: StressInflation) => void
  /** Today's CAPE, for the expensive-markets filter's tooltip. */
  latestCape: number | null
}

/** The stress test's settings: how trials are drawn, how many, and the filters that apply to any method. */
export function StressControls(p: Props) {
  const { sampling, onSampling } = p
  const set = (patch: Partial<SamplingOptions>) => onSampling({ ...sampling, ...patch })
  const simulated = sampling.method !== "history"
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <ChoiceChips label="Method" options={METHOD_OPTIONS} value={sampling.method} onChange={(method) => set({ method })} />
          <InfoTooltip content={METHOD_INFO} />
        </div>
        {simulated && <ChoiceChips label="Trials" options={trialOptions} value={String(sampling.trials)} onChange={(v) => set({ trials: Number(v) })} />}
        {sampling.method === "block" && (
          <ChoiceChips label="Block length" options={blockOptions} value={String(sampling.blockLength)} onChange={(v) => set({ blockLength: Number(v) })} />
        )}
        {simulated && (
          <button type="button" className="btn-secondary inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs md:min-h-0" onClick={() => set({ seed: sampling.seed + 1 })}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              casino
            </span>
            Reroll
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!simulated && p.canAlignRetirement && <ChoiceChips label="Line history up with" options={ALIGN_OPTIONS} value={p.align} onChange={p.onAlign} />}
        <div className="flex items-center gap-1">
          <ChoiceChips label="Expensive markets only" options={CAPE_OPTIONS} value={p.cape} onChange={p.onCape} />
          <InfoTooltip content={capeInfo(p.latestCape)} />
        </div>
        <div className="flex items-center gap-1">
          <ChoiceChips label="Inflation" options={INFLATION_OPTIONS} value={p.inflation} onChange={p.onInflation} />
          <InfoTooltip content={INFLATION_INFO} />
        </div>
      </div>
    </div>
  )
}

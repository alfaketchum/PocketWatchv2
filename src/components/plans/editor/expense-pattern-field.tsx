"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { cn } from "@/lib/utils"
import { customFromGogo, PATTERN_HINTS, PATTERN_LABELS, patternFactor } from "@/lib/plans/plan-spending-patterns"
import type { PatternPreset, SpendingPattern } from "@/lib/plans/plan-types"

const PRESETS = Object.keys(PATTERN_LABELS) as PatternPreset[]
const MAX_PHASES = 10
const SPARK = { width: 140, height: 32, pad: 3 }

/** Tiny curve of the share of today's spending from now to the plan's end, with retirement marked. */
function Sparkline({ pattern, fromAge, toAge, retireAge }: { pattern: SpendingPattern | undefined; fromAge: number; toAge: number; retireAge: number | null }) {
  const ages = Array.from({ length: Math.max(2, toAge - fromAge + 1) }, (_, i) => fromAge + i)
  const values = ages.map((a) => patternFactor(pattern, a, retireAge))
  const top = Math.max(1.3, ...values)
  const x = (i: number) => SPARK.pad + (i / (ages.length - 1)) * (SPARK.width - 2 * SPARK.pad)
  const y = (v: number) => SPARK.height - SPARK.pad - (v / top) * (SPARK.height - 2 * SPARK.pad)
  const retireX = retireAge !== null && retireAge > fromAge && retireAge < toAge ? x(retireAge - fromAge) : null
  return (
    <svg width={SPARK.width} height={SPARK.height} className="text-primary" aria-hidden="true">
      <line x1={SPARK.pad} x2={SPARK.width - SPARK.pad} y1={y(1)} y2={y(1)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="2 2" />
      {retireX !== null && <line x1={retireX} x2={retireX} y1={SPARK.pad} y2={SPARK.height - SPARK.pad} stroke="currentColor" strokeOpacity={0.3} />}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

/** How a spending line changes with age: chips for the presets, a preview curve, and phases for Custom. */
export function ExpensePatternField({
  pattern,
  onChange,
  fromAge,
  toAge,
  retireAge,
}: {
  pattern: SpendingPattern | undefined
  onChange: (pattern: SpendingPattern) => void
  fromAge: number
  toAge: number
  retireAge: number | null
}) {
  const preset = pattern?.preset ?? "steady"
  const phases = pattern?.phases ?? []
  const choose = (p: PatternPreset) => onChange(p === "custom" ? { preset: p, phases: phases.length ? phases : customFromGogo(retireAge) } : { preset: p })
  const setPhase = (i: number, change: Partial<{ fromAge: number; factor: number }>) =>
    onChange({ preset: "custom", phases: phases.map((ph, j) => (j === i ? { ...ph, ...change } : ph)) })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-foreground-muted mb-1">As you age</p>
          <div role="radiogroup" aria-label="Spending pattern" className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                title={PATTERN_HINTS[p]}
                onClick={() => choose(p)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  preset === p ? "border-primary bg-primary text-white" : "border-card-border text-foreground-muted hover:text-foreground",
                )}
              >
                {PATTERN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <Sparkline pattern={pattern} fromAge={fromAge} toAge={toAge} retireAge={retireAge} />
      </div>
      <p className="text-[11px] text-foreground-muted">
        {PATTERN_HINTS[preset]}
        {preset !== "custom" && preset !== "rising" && preset !== "steady" && retireAge === null ? " — add a retirement date for this to take effect." : "."}
      </p>
      {preset === "custom" && (
        <div className="space-y-1.5">
          {phases.map((ph, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <FireNumberField label="From age" min={0} max={120} value={ph.fromAge} onChange={(fromAge) => setPhase(i, { fromAge: Math.round(fromAge) })} />
              <FireNumberField label="Spend" suffix="% of today" scale={100} min={0} max={5} value={ph.factor} onChange={(factor) => setPhase(i, { factor })} />
              <button
                type="button"
                aria-label="Remove phase"
                onClick={() => onChange({ preset: "custom", phases: phases.filter((_, j) => j !== i) })}
                className="btn-ghost h-9 px-2"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          ))}
          {phases.length < MAX_PHASES && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onChange({ preset: "custom", phases: [...phases, { fromAge: (phases.at(-1)?.fromAge ?? fromAge) + 5, factor: 1 }] })}
            >
              + Add phase
            </button>
          )}
        </div>
      )}
    </div>
  )
}

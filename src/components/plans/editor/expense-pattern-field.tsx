"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { customFrom, PATTERN_HINTS, PATTERN_LABELS, patternFactor, switchAge } from "@/lib/plans/plan-spending-patterns"
import type { PatternPreset, SpendingPattern, SpendingStage } from "@/lib/plans/plan-types"

const PRESET_OPTIONS = (Object.keys(PATTERN_LABELS) as PatternPreset[]).map((value) => ({ value, label: PATTERN_LABELS[value] }))
type Switch = "none" | "retirement" | "age"
const SWITCH_OPTIONS: { value: Switch; label: string }[] = [
  { value: "none", label: "no change" },
  { value: "retirement", label: "at retirement" },
  { value: "age", label: "at age" },
]
const MAX_PHASES = 10
/** Inline so the global (unlayered) form styles don't blow the chips up to full-size fields. */
const CHIP_STYLE = { fontSize: 11, lineHeight: "16px", height: "auto", minHeight: 0, padding: "2px 22px 2px 10px", borderRadius: 9999 } as const
const AGE_STYLE = { ...CHIP_STYLE, width: 52, padding: "2px 8px" } as const
const SPARK = { width: 140, height: 32, pad: 3 }

/** A compact dropdown styled as a chip. */
function ChipSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={CHIP_STYLE}
        className="appearance-none border border-primary/40 bg-primary/5 font-medium text-foreground hover:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-rounded pointer-events-none absolute right-1.5 text-foreground-muted" style={{ fontSize: 14 }}>
        expand_more
      </span>
    </label>
  )
}

/** Tiny curve of the share of today's spending from now to the plan's end, with the switch marked. */
function Sparkline({ pattern, fromAge, toAge, retireAge }: { pattern: SpendingPattern | undefined; fromAge: number; toAge: number; retireAge: number | null }) {
  const ages = Array.from({ length: Math.max(2, toAge - fromAge + 1) }, (_, i) => fromAge + i)
  const values = ages.map((a) => patternFactor(pattern, a, retireAge, fromAge))
  const top = Math.max(1.3, ...values)
  const x = (i: number) => SPARK.pad + (i / (ages.length - 1)) * (SPARK.width - 2 * SPARK.pad)
  const y = (v: number) => SPARK.height - SPARK.pad - (v / top) * (SPARK.height - 2 * SPARK.pad)
  const at = switchAge(pattern, retireAge)
  const switchX = at !== null && at > fromAge && at < toAge ? x(at - fromAge) : null
  return (
    <svg width={SPARK.width} height={SPARK.height} className="text-primary shrink-0" aria-hidden="true">
      <line x1={SPARK.pad} x2={SPARK.width - SPARK.pad} y1={y(1)} y2={y(1)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="2 2" />
      {switchX !== null && <line x1={switchX} x2={switchX} y1={SPARK.pad} y2={SPARK.height - SPARK.pad} stroke="currentColor" strokeOpacity={0.3} />}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  )
}

/** Custom phases for one stage: from each age, a share of today's amount. */
function PhasesEditor({ title, phases, startAge, onChange }: { title: string; phases: { fromAge: number; factor: number }[]; startAge: number; onChange: (phases: { fromAge: number; factor: number }[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-foreground-muted">{title}</p>
      {phases.map((ph, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <FireNumberField label="From age" min={0} max={120} value={ph.fromAge} onChange={(fromAge) => onChange(phases.map((p, j) => (j === i ? { ...p, fromAge: Math.round(fromAge) } : p)))} />
          <FireNumberField label="Spend" suffix="% of today" scale={100} min={0} max={5} value={ph.factor} onChange={(factor) => onChange(phases.map((p, j) => (j === i ? { ...p, factor } : p)))} />
          <button type="button" aria-label="Remove phase" onClick={() => onChange(phases.filter((_, j) => j !== i))} className="btn-ghost h-9 px-2">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              close
            </span>
          </button>
        </div>
      ))}
      {phases.length < MAX_PHASES && (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange([...phases, { fromAge: (phases.at(-1)?.fromAge ?? startAge) + 5, factor: 1 }])}>
          + Add phase
        </button>
      )}
    </div>
  )
}

/** A stage with its preset changed; switching to Custom starts from go-go-like phases. */
function withPreset<S extends SpendingStage>(stage: S, preset: PatternPreset, startAge: number): S {
  return preset === "custom" ? { ...stage, preset, phases: stage.phases?.length ? stage.phases : customFrom(startAge) } : { ...stage, preset, phases: undefined }
}

/** The dropdown chips: pattern from now, when it changes, and the pattern after. Used on cards and in the table. */
export function PatternChips({
  pattern,
  onChange,
  fromAge,
  retireAge,
  nowrap = false,
}: {
  pattern: SpendingPattern | undefined
  onChange: (pattern: SpendingPattern) => void
  fromAge: number
  retireAge: number | null
  /** Keep on one line (table rows). */
  nowrap?: boolean
}) {
  const current: SpendingPattern = pattern ?? { preset: "steady" }
  const then = current.then
  const switchKind: Switch = then ? then.at : "none"
  const thenStart = switchAge(current, retireAge) ?? retireAge ?? fromAge
  const setSwitch = (kind: Switch) =>
    onChange(
      kind === "none"
        ? { ...current, then: undefined }
        : { ...current, then: { preset: then?.preset ?? "steady", phases: then?.phases, at: kind, ...(kind === "age" ? { age: then?.age ?? retireAge ?? fromAge + 10 } : {}) } },
    )
  return (
    <div className={`flex items-center gap-1 text-[11px] text-foreground-muted whitespace-nowrap ${nowrap ? "" : "flex-wrap"}`}>
      <span>From now</span>
      <ChipSelect label="Pattern from now" value={current.preset} options={PRESET_OPTIONS} onChange={(p) => onChange(withPreset(current, p, fromAge))} />
      <span>then</span>
      <ChipSelect label="When it changes" value={switchKind} options={SWITCH_OPTIONS} onChange={setSwitch} />
      {then?.at === "age" && (
        <input
          type="number"
          aria-label="Age it changes"
          min={0}
          max={120}
          value={then.age ?? ""}
          onChange={(e) => onChange({ ...current, then: { ...then, age: Math.round(Number(e.target.value) || 0) } })}
          style={AGE_STYLE}
          className="border border-primary/40 bg-primary/5 text-foreground"
        />
      )}
      {then && (
        <>
          <span>→</span>
          <ChipSelect label="Pattern after it changes" value={then.preset} options={PRESET_OPTIONS} onChange={(p) => onChange({ ...current, then: withPreset(then, p, thenStart) })} />
        </>
      )}
    </div>
  )
}

/**
 * How a spending line changes over time: a pattern from now, and optionally a second one from retirement or
 * a chosen age, picked with dropdown chips, with a preview curve.
 */
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
  const current: SpendingPattern = pattern ?? { preset: "steady" }
  const then = current.then
  const at = switchAge(current, retireAge)
  const thenStart = at ?? retireAge ?? fromAge
  const whenLabel = then?.at === "retirement" ? `From retirement${retireAge !== null ? ` (age ${retireAge})` : ""}` : `From age ${at ?? "?"}`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PatternChips pattern={current} onChange={onChange} fromAge={fromAge} retireAge={retireAge} />
        <Sparkline pattern={current} fromAge={fromAge} toAge={toAge} retireAge={retireAge} />
      </div>
      <p className="text-[11px] text-foreground-muted">
        Now: {PATTERN_HINTS[current.preset]}.
        {then && (
          <>
            {" "}
            {whenLabel}: {PATTERN_HINTS[then.preset]}
            {then.preset !== "custom" && current.preset !== "steady" ? ", from where it had got to" : ""}.
            {then.at === "retirement" && retireAge === null ? " Add a retirement date for this to take effect." : ""}
          </>
        )}
      </p>
      {current.preset === "custom" && (
        <PhasesEditor title="Custom phases (from now)" phases={current.phases ?? []} startAge={fromAge} onChange={(phases) => onChange({ ...current, phases })} />
      )}
      {then?.preset === "custom" && (
        <PhasesEditor title="Custom phases (after the change)" phases={then.phases ?? []} startAge={thenStart} onChange={(phases) => onChange({ ...current, then: { ...then, phases } })} />
      )}
    </div>
  )
}

"use client"

import type { ReactNode } from "react"
import { baselineOf, isWhatIfEmpty, WHAT_IF_LIMITS, type WhatIf } from "@/lib/plans/plan-what-if"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { WhatIfEvents } from "./what-if-events"

interface DialProps {
  label: string
  /** The dial's value as shown ("Age 62", "+10%"). */
  shown: string
  /** The plan's own value, shown while the dial is moved. */
  planValue: string
  moved: boolean
  onReset: () => void
  children: ReactNode
}

function Dial({ label, shown, planValue, moved, onReset, children }: DialProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-xs tabular-nums font-semibold ${moved ? "text-primary" : "text-foreground"}`}>{shown}</span>
          {moved && (
            <button type="button" onClick={onReset} title={`Back to the plan's ${planValue}`} aria-label={`Reset ${label}`} className="text-foreground-muted hover:text-foreground">
              <span className="material-symbols-rounded block" style={{ fontSize: 14 }} aria-hidden="true">
                undo
              </span>
            </button>
          )}
        </span>
      </div>
      {children}
      <p className="text-[10px] text-foreground-muted">Plan: {planValue}</p>
    </div>
  )
}

interface RangeProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function Range({ label, value, min, max, step, onChange }: RangeProps) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[var(--primary)]"
    />
  )
}

const pctText = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))}%`
const ptsText = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)} pts`
const inflText = (v: number) => `${(v * 100).toFixed(1)}%`
/** Floating-point steps (0.1% of inflation) back to tidy numbers. */
const tidy = (v: number) => Math.round(v * 10_000) / 10_000

interface Props {
  doc: PlanDocument
  dials: WhatIf
  onChange: (next: WhatIf) => void
  onSave: () => void
}

/** The what-if dials: each starts at the plan's own value; moving one back there un-moves it. */
export function WhatIfDials({ doc, dials, onChange, onSave }: Props) {
  const base = baselineOf(doc)
  const L = WHAT_IF_LIMITS
  const set = (patch: Partial<WhatIf>) => onChange({ ...dials, ...patch })
  const retire = dials.retireAge ?? base.retireAge
  const inflation = dials.inflation ?? base.inflation
  const claim = dials.ssClaimAge ?? base.ssClaimAge
  const spend = dials.spendPct ?? 0
  const shift = dials.returnShift ?? 0

  return (
    <section className="space-y-4 rounded-2xl border border-card-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Dials</p>
      {retire !== null && base.retireAge !== null && (
        <Dial label="Retire at" shown={`Age ${retire}`} planValue={`age ${base.retireAge}`} moved={dials.retireAge !== undefined} onReset={() => set({ retireAge: undefined })}>
          <Range label="Retire at" value={retire} {...L.retireAge} onChange={(v) => set({ retireAge: v === base.retireAge ? undefined : v })} />
        </Dial>
      )}
      <Dial label="Spending" shown={spend ? pctText(spend) : "As planned"} planValue="as planned" moved={!!spend} onReset={() => set({ spendPct: undefined })}>
        <Range label="Spending" value={spend} {...L.spendPct} onChange={(v) => set({ spendPct: tidy(v) || undefined })} />
      </Dial>
      <Dial label="Market returns" shown={shift ? ptsText(shift) : "As planned"} planValue="as planned" moved={!!shift} onReset={() => set({ returnShift: undefined })}>
        <Range label="Market returns" value={shift} {...L.returnShift} onChange={(v) => set({ returnShift: tidy(v) || undefined })} />
      </Dial>
      <Dial label="Inflation" shown={inflText(inflation)} planValue={inflText(base.inflation)} moved={dials.inflation !== undefined} onReset={() => set({ inflation: undefined })}>
        <Range label="Inflation" value={inflation} {...L.inflation} onChange={(v) => set({ inflation: tidy(v) === tidy(base.inflation) ? undefined : tidy(v) })} />
      </Dial>
      {claim !== null && base.ssClaimAge !== null && (
        <Dial label="Claim Social Security at" shown={`Age ${claim}`} planValue={`age ${base.ssClaimAge}`} moved={dials.ssClaimAge !== undefined} onReset={() => set({ ssClaimAge: undefined })}>
          <Range label="Claim Social Security at" value={claim} {...L.ssClaimAge} onChange={(v) => set({ ssClaimAge: v === base.ssClaimAge ? undefined : v })} />
        </Dial>
      )}
      <WhatIfEvents events={dials.events} startYear={doc.settings.startYear} onChange={(events) => set({ events })} />
      <div className="flex items-center justify-between gap-2 border-t border-card-border pt-4">
        <button type="button" onClick={() => onChange({ events: [] })} disabled={isWhatIfEmpty(dials)} className="btn-ghost text-xs disabled:opacity-40">
          Reset all
        </button>
        <button type="button" onClick={onSave} disabled={isWhatIfEmpty(dials)} className="btn-primary text-xs disabled:opacity-40">
          Save as new plan…
        </button>
      </div>
    </section>
  )
}

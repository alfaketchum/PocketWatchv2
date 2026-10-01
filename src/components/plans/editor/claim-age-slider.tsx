"use client"

import { useId } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { claimFactor, fullRetirementAge, SS_EARLIEST_AGE, SS_LATEST_AGE } from "@/lib/plans/social-security"
import { cn } from "@/lib/utils"

const AGES = Array.from({ length: SS_LATEST_AGE - SS_EARLIEST_AGE + 1 }, (_, i) => SS_EARLIEST_AGE + i)

const pct = (factor: number) => `${Math.round(factor * 100)}%`

/**
 * Claiming age as a slider from 62 to 70 (no gain after 70), with the share of the full-retirement-age benefit and
 * the monthly check at the chosen age beside it (below on narrow screens).
 */
export function ClaimAgeSlider({
  age,
  birthYear,
  monthlyAtFra,
  onChange,
}: {
  age: number
  birthYear: number
  /** Benefit at full retirement age, per month; null when it isn't known yet (estimated from earnings). */
  monthlyAtFra: number | null
  onChange: (age: number) => void
}) {
  const id = useId()
  const fra = fullRetirementAge(birthYear)
  const fraAge = Math.round(fra)
  const factor = claimFactor(birthYear, age)
  const span = SS_LATEST_AGE - SS_EARLIEST_AGE
  return (
    <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-foreground-muted">
          Claim at age
        </label>
        <input
          id={id}
          type="range"
          min={SS_EARLIEST_AGE}
          max={SS_LATEST_AGE}
          step={1}
          value={age}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`Age ${age}: ${pct(factor)} of your full benefit`}
          className="w-full accent-[var(--primary)]"
        />
        {/* Inset by half the slider's thumb so each age sits under the thumb's centre. */}
        <div className="relative mx-2 mt-1 h-7 text-[10px] tabular-nums" aria-hidden="true">
          {AGES.map((a) => (
            <span
              key={a}
              className={cn("absolute -translate-x-1/2 text-center leading-tight", a === age ? "font-semibold text-primary" : "text-foreground-muted")}
              style={{ left: `${((a - SS_EARLIEST_AGE) / span) * 100}%` }}
            >
              {a}
              {a === fraAge && <span className="block text-[9px] font-normal">full</span>}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0 rounded-xl border border-card-border px-3 py-2 sm:w-40 sm:text-right" aria-live="polite">
        <p className="text-[11px] text-foreground-muted">At {age} you get</p>
        <p className="text-xl font-semibold tabular-nums text-foreground">{pct(factor)}</p>
        <p className="text-[11px] text-foreground-muted">
          of your full benefit{monthlyAtFra !== null && monthlyAtFra > 0 ? ` · ${fmtMoney(monthlyAtFra * factor)}/mo` : ""}
        </p>
      </div>
    </div>
  )
}

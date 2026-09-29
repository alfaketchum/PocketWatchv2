"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface FireNumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  /** Display multiplier, e.g. 100 to edit a 0.05 rate as "5". */
  scale?: number
  min?: number
  max?: number
  hint?: string
  /** When set, shows an "auto" chip while following the baseline and a reset link otherwise. */
  auto?: { isAuto: boolean; onReset: () => void }
}

function display(value: number, scale: number): string {
  const scaled = value * scale
  return Number.isInteger(scaled) ? String(scaled) : String(Math.round(scaled * 100) / 100)
}

/** Labeled numeric input that commits on blur/Enter so typing doesn't thrash calculations. */
export function FireNumberField({
  label, value, onChange, prefix, suffix, scale = 1, min, max, hint, auto,
}: FireNumberFieldProps) {
  const [draft, setDraft] = useState(() => display(value, scale))

  useEffect(() => {
    setDraft(display(value, scale))
  }, [value, scale])

  const commit = () => {
    const parsed = Number(draft.replace(/[,$\s]/g, ""))
    if (!Number.isFinite(parsed)) {
      setDraft(display(value, scale))
      return
    }
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed / scale))
    if (bounded !== value) onChange(bounded)
    else setDraft(display(value, scale))
  }

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-medium text-foreground-muted">{label}</span>
        {auto && (auto.isAuto ? (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
            auto
          </span>
        ) : (
          <button type="button" onClick={auto.onReset} className="text-[10px] text-primary hover:underline">
            reset to auto
          </button>
        ))}
      </span>
      <span className="flex items-center rounded-lg border border-card-border bg-background focus-within:border-primary transition-colors">
        {prefix && <span className="pl-2.5 text-xs text-foreground-muted">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
          className={cn("w-full bg-transparent px-2.5 py-1.5 text-sm tabular-nums text-foreground outline-none")}
        />
        {suffix && <span className="pr-2.5 text-xs text-foreground-muted">{suffix}</span>}
      </span>
      {hint && <span className="block text-[10px] text-foreground-muted mt-1">{hint}</span>}
    </label>
  )
}

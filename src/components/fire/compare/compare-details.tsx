"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { FireCompareInputs } from "@/lib/fire/fire-types"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { ChoiceChips } from "../fire-input-controls"
import { FireNumberField } from "../fire-number-field"
import { OccupationPicker, occupationBySoc } from "./occupation-picker"
import { fmtShort } from "./percentile-bar"

export const EDUCATION_LABELS: Record<number, string> = {
  1: "No high school diploma",
  2: "High school",
  3: "Some college",
  4: "College degree",
}

/** Household income used for comparisons: your entry, else the plan's income estimate. */
export function householdIncomeOf(state: FirePlanState): number | null {
  return state.inputs.compare.householdIncome ?? state.baseline.annualIncome
}

function ZipField({ value, onChange }: { value: string | null; onChange: (zip: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "")
  useEffect(() => setDraft(value ?? ""), [value])
  const valid = /^\d{5}$/.test(draft)
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1">Zip code</span>
      <input
        inputMode="numeric"
        maxLength={5}
        value={draft}
        placeholder="e.g. 94110"
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={() => onChange(valid ? draft : draft === "" ? null : value)}
        className={cn(
          "w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm tabular-nums text-foreground outline-none focus:border-primary",
          draft && !valid ? "border-error" : "border-card-border",
        )}
      />
      <span className="block text-[10px] text-foreground-muted mt-1">Looked up on our server only</span>
    </label>
  )
}

/** "Your details" for comparisons: summary line + inline editor. */
export function CompareDetails({ state }: { state: FirePlanState }) {
  const [open, setOpen] = useState(false)
  const { inputs, update, baseline } = state
  const c = inputs.compare
  const set = (patch: Partial<FireCompareInputs>) => update({ compare: { ...c, ...patch } })
  const household = householdIncomeOf(state)
  const occupation = occupationBySoc(c.occupation)

  const chips = [
    `Age ${inputs.currentAge}`,
    c.zip ? `Zip ${c.zip}` : "No zip",
    occupation ? occupation.title : "No occupation",
    c.education ? EDUCATION_LABELS[c.education] : "Education not set",
    household !== null ? `${fmtShort(household)}/yr household` : "Income not set",
  ]

  return (
    <section className="bg-card border border-card-border rounded-2xl p-5 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Your details</p>
          <p className="text-xs text-foreground-muted truncate mt-1">{chips.join(" · ")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex items-center gap-1.5 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
            open ? "border-primary bg-primary text-white" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{open ? "check" : "tune"}</span>
          {open ? "Done" : "Edit details"}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ZipField value={c.zip} onChange={(zip) => set({ zip })} />
            <div className="lg:col-span-2">
              <OccupationPicker value={c.occupation} onChange={(occupation) => set({ occupation })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[520px]">
            <FireNumberField
              label="Household income / yr"
              prefix="$"
              value={Math.round(household ?? 0)}
              min={0}
              onChange={(householdIncome) => set({ householdIncome })}
              hint="Pre-tax, all sources, incl. investments"
              auto={{ isAuto: c.householdIncome === null && baseline.annualIncome !== null, onReset: () => set({ householdIncome: null }) }}
            />
            <FireNumberField
              label="Your pay from work / yr"
              prefix="$"
              value={Math.round(c.earnedIncome ?? 0)}
              min={0}
              onChange={(earnedIncome) => set({ earnedIncome: earnedIncome > 0 ? earnedIncome : null })}
              hint="For the profession comparison"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-foreground-muted mb-2">Education</p>
            <ChoiceChips
              label="Education"
              options={Object.entries(EDUCATION_LABELS).map(([k, label]) => ({ value: k, label }))}
              value={c.education ? String(c.education) : ""}
              onChange={(v) => set({ education: Number(v) })}
            />
          </div>
          <p className="text-[11px] text-foreground-muted">Your age comes from the FIRE Plan. Details are saved with your FIRE profile.</p>
        </div>
      )}
    </section>
  )
}

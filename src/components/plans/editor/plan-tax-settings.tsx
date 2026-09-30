"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { ChoiceChips, InputBlock } from "@/components/fire/fire-input-controls"
import type { PlanSettings } from "@/lib/plans/plan-types"
import { STATE_CODES, STATE_TAX } from "@/lib/plans/tax/state-2026"
import { stateGainsNote } from "@/lib/plans/tax/state-gains-2026"
import { SelectField } from "./plan-editor-controls"

export const NO_STATE = "none"

export const STATE_OPTIONS = [
  { value: NO_STATE, label: "None / outside the US" },
  ...STATE_CODES.map((code) => ({ value: code, label: STATE_TAX[code].name })),
]

const MODES: { value: PlanSettings["taxMode"]; label: string }[] = [
  { value: "brackets", label: "Tax brackets" },
  { value: "flat", label: "Flat rates" },
]

const STATUSES: { value: PlanSettings["filingStatus"]; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "joint", label: "Married filing jointly" },
]

/** How the state taxes income and gains, in a few words. */
function stateNote(state: string | null): string {
  const table = state ? STATE_TAX[state] : undefined
  const gains = stateGainsNote(state)
  if (gains && table?.kind === "none") return gains
  const income =
    !table || table.kind === "none"
      ? "No state income tax."
      : table.kind === "flat"
        ? `Flat ${+((table.rate ?? 0) * 100).toFixed(2)}% state tax.`
        : "Progressive state brackets."
  return gains ? `${income} ${gains}` : income
}

/** Assumptions → Taxes: real 2026 brackets for a state and filing status, or flat effective rates. */
export function PlanTaxSettings({ settings: s, set }: { settings: PlanSettings; set: (change: Partial<PlanSettings>) => void }) {
  const brackets = s.taxMode === "brackets"
  return (
    <InputBlock
      title="Taxes"
      description={
        brackets
          ? "2026 federal and state brackets and standard deduction, rising with inflation. Long-term gains at 0/15/20%, short-term as income, plus 3.8% NIIT on high incomes. 85% of Social Security taxed."
          : "One effective rate for income (and short-term gains) and one for long-term gains."
      }
    >
      <ChoiceChips label="Tax model" options={MODES} value={s.taxMode} onChange={(taxMode) => set({ taxMode })} />
      {brackets ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <SelectField label="State you live in" value={s.state ?? NO_STATE} options={STATE_OPTIONS} onChange={(v) => set({ state: v === NO_STATE ? null : v })} />
            <p className="text-[10px] text-foreground-muted mt-1">{stateNote(s.state)}</p>
          </div>
          <SelectField label="Filing status" value={s.filingStatus} options={STATUSES} onChange={(filingStatus) => set({ filingStatus })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField
            label="Income tax (effective)"
            suffix="%"
            scale={100}
            min={0}
            max={1}
            value={s.incomeTaxRate}
            hint="Also applies to traditional withdrawals."
            onChange={(incomeTaxRate) => set({ incomeTaxRate })}
          />
          <FireNumberField label="Long-term gains tax" suffix="%" scale={100} min={0} max={1} value={s.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
        </div>
      )}
    </InputBlock>
  )
}

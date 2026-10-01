"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { ChoiceChips, InputBlock } from "@/components/fire/fire-input-controls"
import type { PlanSettings } from "@/lib/plans/plan-types"

/** 2026 Trustees Report: the retirement (OASI) trust fund runs out late in 2032; taxes then cover 78% of benefits. */
const TRUSTEES = { share: 0.22, fromYear: 2033 }

type Mode = "full" | "trustees" | "custom"

const MODES: { value: Mode; label: string }[] = [
  { value: "full", label: "Paid in full" },
  { value: "trustees", label: "Trust fund shortfall" },
  { value: "custom", label: "Your own cut" },
]

function modeOf(cut: PlanSettings["ssCut"]): Mode {
  if (!cut) return "full"
  return cut.share === TRUSTEES.share && cut.fromYear === TRUSTEES.fromYear ? "trustees" : "custom"
}

/** Assumptions → Social Security: scheduled benefits in full, the Trustees' projected shortfall, or your own cut. */
export function SocialSecurityOutlook({ settings, set }: { settings: PlanSettings; set: (change: Partial<PlanSettings>) => void }) {
  const cut = settings.ssCut
  const mode = modeOf(cut)
  const choose = (next: Mode) => {
    if (next === "full") set({ ssCut: undefined })
    else if (next === "trustees") set({ ssCut: TRUSTEES })
    else set({ ssCut: cut ?? { share: 0.1, fromYear: TRUSTEES.fromYear } })
  }
  return (
    <InputBlock title="Social Security outlook" description="Whether benefits are paid as scheduled. Benefits themselves are set on the Income tab.">
      <ChoiceChips label="Social Security outlook" options={MODES} value={mode} onChange={choose} />
      {mode === "trustees" && (
        <p className="text-[11px] text-foreground-muted">
          The 2026 Trustees Report projects the retirement trust fund runs out late in 2032; payroll taxes then cover about 78% of
          scheduled benefits. Benefits are cut 22% from 2033 unless Congress acts.
        </p>
      )}
      {mode === "custom" && cut && (
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField label="Benefits cut by" suffix="%" scale={100} min={0} max={1} value={cut.share} onChange={(share) => set({ ssCut: { ...cut, share } })} />
          <FireNumberField label="From (year)" min={2000} max={2200} value={cut.fromYear} onChange={(fromYear) => set({ ssCut: { ...cut, fromYear: Math.round(fromYear) } })} />
        </div>
      )}
    </InputBlock>
  )
}

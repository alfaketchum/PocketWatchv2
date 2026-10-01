"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { TimingPicker } from "./timing-picker"

export interface DivorceDraft {
  when: Timing
  endIncomeIds: string[]
  exShare: number
  legalCost: number
  supportPerYear: number
  years: number
  percent: number
  incomeTaxRate: number
  capitalGainsRate: number
}

/** Incomes that look like your partner's: added with them when you married, or named after them. */
export function partnerIncomeIds(doc: PlanDocument): string[] {
  const partner = doc.people[1]?.name.trim().toLowerCase()
  return doc.incomes
    .filter((i) => !i.oneTime && (i.origin?.startsWith("ms-married") || (partner && i.name.toLowerCase().startsWith(partner))))
    .map((i) => i.id)
}

/** Divorce form: when, whose income stops, the account split, costs and support. */
export function DivorceFields({ d, set, doc }: { d: DivorceDraft; set: (change: Partial<DivorceDraft>) => void; doc: PlanDocument }) {
  const incomes = doc.incomes.filter((i) => !i.oneTime)
  const toggle = (id: string, on: boolean) => set({ endIncomeIds: on ? [...d.endIncomeIds, id] : d.endIncomeIds.filter((x) => x !== id) })
  return (
    <>
      <TimingPicker label="When" value={d.when} doc={doc} allow={["year", "age", "milestone"]} onChange={(when) => set({ when })} />
      {incomes.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-foreground-muted">Income that stops (your ex&apos;s)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {incomes.map((i) => (
              <Toggle key={i.id} label={i.name} checked={d.endIncomeIds.includes(i.id)} onChange={(on) => toggle(i.id, on)} />
            ))}
          </div>
        </div>
      )}
      <FireNumberField
        label="Your ex keeps (share of each account)"
        suffix="%"
        scale={100}
        min={0}
        max={1}
        value={d.exShare}
        hint="Moved out untaxed, as transfers in a divorce are. Homes and debts are edited on Assets & debts."
        onChange={(exShare) => set({ exShare })}
      />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Legal and moving costs" prefix="$" min={0} value={d.legalCost} onChange={(legalCost) => set({ legalCost })} />
        <FireNumberField
          label="Your spending changes by"
          suffix="%"
          scale={100}
          min={-0.95}
          max={5}
          value={d.percent}
          hint="One household instead of two shared costs."
          onChange={(percent) => set({ percent })}
        />
        <FireNumberField label="Support you pay / yr (0 for none)" prefix="$" min={0} value={d.supportPerYear} onChange={(supportPerYear) => set({ supportPerYear })} />
        <FireNumberField label="For how many years" min={1} max={40} value={d.years} onChange={(years) => set({ years })} />
      </div>
      {doc.settings.taxMode === "brackets" ? (
        <p className="text-[11px] text-foreground-muted">You file single from then on.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField label="New income tax rate" suffix="%" scale={100} min={0} max={1} value={d.incomeTaxRate} hint="Filing single often raises it." onChange={(incomeTaxRate) => set({ incomeTaxRate })} />
          <FireNumberField label="New capital gains rate" suffix="%" scale={100} min={0} max={1} value={d.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
        </div>
      )}
    </>
  )
}

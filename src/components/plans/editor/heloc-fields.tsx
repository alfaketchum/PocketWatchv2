"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { helocTerms, scheduledPayment } from "@/lib/plans/plan-debt-payments"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { HelocTerms, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

interface Props {
  debt: PlanDebt
  doc: PlanDocument
  onChange: (change: Partial<PlanDebt>) => void
}

const MAX_YEARS = 30

/** A HELOC's draw and repayment periods, what it was spent on, and the payments that follow. */
export function HelocFields({ debt, doc, onChange }: Props) {
  const terms = helocTerms(debt)
  if (!terms) return null
  const set = (change: Partial<HelocTerms>) => onChange({ heloc: { ...terms, ...change } })
  const years = (v: number, min: number) => Math.min(MAX_YEARS, Math.max(min, Math.round(v)))
  const start = Math.max(0, resolveTiming(debt.start, timingContext(doc)) ?? 0)
  const drawEnds = doc.settings.startYear + start + terms.drawYears
  const home = doc.assets.find((a) => a.id === debt.assetId && a.kind === "home")
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 items-end">
        <FireNumberField label="Draw period left (years)" min={0} max={MAX_YEARS} value={terms.drawYears} onChange={(v) => set({ drawYears: years(v, 0) })} />
        <FireNumberField label="Repay over (years)" min={1} max={MAX_YEARS} value={terms.repayYears} onChange={(v) => set({ repayYears: years(v, 1) })} />
      </div>
      <Toggle label="Spent buying, building or improving the home" checked={terms.forHome} onChange={(forHome) => set({ forHome })} />
      <p className="text-[11px] text-foreground-muted">
        {terms.drawYears > 0 && <>Interest only, {fmtMoney(scheduledPayment(debt, 0))}/mo, until {drawEnds - 1}; then </>}
        {fmtMoney(scheduledPayment(debt, terms.drawYears))}/mo for {terms.repayYears} years.{" "}
        {terms.forHome
          ? "Its interest can be itemized like mortgage interest."
          : "Its interest isn't deductible: only home-equity debt spent on the home qualifies."}
        {start > 0 && " The amount drawn lands in your cash flow that year."}
      </p>
      {!home && <p className="text-[11px] text-warning">Link it to the home it borrows against, so selling the home pays it off.</p>}
    </div>
  )
}

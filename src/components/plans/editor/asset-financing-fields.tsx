"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { effectiveFinancing, loanSummary, PAYMENT_MODE_LABELS, TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import type { AssetFinancing, PaymentMode, PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { SelectField } from "./plan-editor-controls"

const PAY_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }))

/** Where a future purchase's money comes from: cash, a loan on set terms, or typical terms for now. */
export function AssetFinancingFields({
  asset,
  doc,
  onChange,
}: {
  asset: PlanAsset
  doc: PlanDocument
  onChange: (financing: AssetFinancing) => void
}) {
  if (asset.start.type === "planStart" || asset.acquired === "received") return null
  const linked = doc.debts.find((d) => d.assetId === asset.id)
  if (linked) {
    return (
      <p className="text-xs text-foreground-muted">
        Paid with <span className="font-medium text-foreground">{linked.name}</span> (under Debts). The down payment is the price minus that loan.
      </p>
    )
  }
  const financing: AssetFinancing = asset.financing ?? { mode: "cash", ...TYPICAL_FINANCING[asset.kind] }
  const set = (change: Partial<AssetFinancing>) => onChange({ ...financing, ...change })
  const terms = effectiveFinancing({ ...asset, financing })
  const loan = terms ? loanSummary(asset.value, terms) : null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <SelectField label="How you'll pay" value={financing.mode} options={PAY_OPTIONS} onChange={(mode) => set({ mode })} />
        {financing.mode === "loan" && (
          <>
            <FireNumberField label="Down payment" suffix="%" scale={100} min={0} max={1} value={financing.downShare} onChange={(downShare) => set({ downShare })} />
            <FireNumberField label="Loan rate" suffix="%" scale={100} min={0} max={1} value={financing.rate} onChange={(rate) => set({ rate })} />
            <FireNumberField label="Term (years)" min={1} max={50} value={financing.termYears} onChange={(termYears) => set({ termYears })} />
          </>
        )}
      </div>
      <p className="text-xs text-foreground-muted">
        {!loan || !terms ? (
          <>The full price comes out of your cash flow the year you buy it.</>
        ) : (
          <>
            {financing.mode === "undecided" && (
              <>Estimated with typical terms ({Math.round(terms.downShare * 100)}% down, {(terms.rate * 100).toFixed(1)}%, {terms.termYears} years). </>
            )}
            In today&apos;s dollars: {fmtMoney(loan.down)} down, then about {fmtMoney(loan.monthly)}/mo for {terms.termYears} years (
            {fmtMoney(loan.totalInterest)} interest). Cash instead: {fmtMoney(asset.value)} that year.
          </>
        )}
      </p>
    </div>
  )
}

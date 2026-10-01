"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { projectedScoreAt } from "@/lib/plans/credit-projection"
import { effectiveFinancing, loanSummary, PAYMENT_MODE_LABELS, TYPICAL_FINANCING, typicalTerms } from "@/lib/plans/plan-financing"
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
  const score = projectedScoreAt(doc, asset.start)
  const terms = effectiveFinancing({ ...asset, financing }, score)
  const scored = score === null ? null : typicalTerms(asset, score).rate
  const loan = terms ? loanSummary(asset.value, terms) : null
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 items-end">
        <SelectField label="How you'll pay" value={financing.mode} options={PAY_OPTIONS} onChange={(mode) => set({ mode })} />
        {financing.mode === "loan" && (
          <>
            <FireNumberField label="Down payment" suffix="%" scale={100} min={0} max={1} value={financing.downShare} onChange={(downShare) => set({ downShare })} />
            <FireNumberField label="Loan rate" suffix="%" scale={100} min={0} max={1} value={financing.rate} onChange={(rate) => set({ rate })} />
            <FireNumberField label="Term (years)" min={1} max={50} value={financing.termYears} onChange={(termYears) => set({ termYears: Math.max(1, Math.round(termYears)) })} />
            <FireNumberField
              label="Extra / month (today's $)"
              prefix="$"
              min={0}
              value={financing.extraMonthly ?? 0}
              onChange={(v) => set({ extraMonthly: v > 0 ? v : undefined })}
            />
          </>
        )}
      </div>
      {financing.mode === "loan" && scored !== null && Math.abs(scored - financing.rate) >= 0.00005 && (
        <p className="text-[11px] text-foreground-muted">
          Typical for your projected score of {score}: {(scored * 100).toFixed(2)}%.{" "}
          <button type="button" onClick={() => set({ rate: scored })} className="text-primary hover:underline">
            Use it
          </button>
        </p>
      )}
      <p className="text-xs text-foreground-muted">
        {!loan || !terms ? (
          <>The full price comes out of your cash flow the year you buy it.</>
        ) : (
          <>
            {financing.mode === "undecided" && (
              <>
                Estimated with typical terms ({Math.round(terms.downShare * 100)}% down, {(terms.rate * 100).toFixed(2)}%
                {score !== null && ` at a projected ${score} score`}, {terms.termYears} years).{" "}
              </>
            )}
            In today&apos;s dollars: {fmtMoney(loan.down)} down, then about {fmtMoney(loan.monthly)}/mo for {terms.termYears} years (
            {fmtMoney(loan.totalInterest)} interest). Cash instead: {fmtMoney(asset.value)} that year.
          </>
        )}
      </p>
    </div>
  )
}

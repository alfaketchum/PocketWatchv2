"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { loanSummary, PAYMENT_MODE_LABELS, TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import type { PaymentMode, PlanDocument } from "@/lib/plans/plan-types"
import { SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { WHEN_TYPES, type SetDraft, type TemplateDraft } from "./template-draft"

const PAY_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }))

/** Buy a home or vehicle: price, when, and how it's paid (with the loan it implies). */
export function PurchaseFields({ d, set, doc, kind }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument; kind: "home" | "vehicle" }) {
  const typical = TYPICAL_FINANCING[kind]
  const terms = d.payWith === "undecided" ? typical : { downShare: d.price > 0 ? d.downPayment / d.price : 0, rate: d.rate, termYears: d.termYears }
  const loan = loanSummary(d.price, terms)
  return (
    <>
      <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
      <TimingPicker label="Buy" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(when) => set({ when })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Price (today's $)" prefix="$" min={0} value={d.price} onChange={(price) => set({ price })} />
        <SelectField label="How you'll pay" value={d.payWith} options={PAY_OPTIONS} onChange={(payWith) => set({ payWith })} />
      </div>
      {kind === "vehicle" && (
        <FireNumberField
          label="Replace every (years)"
          min={0}
          max={50}
          value={d.replaceEvery}
          hint="0 = keep it. Each time, it's sold at its value and a like one bought at today's price plus inflation."
          onChange={(replaceEvery) => set({ replaceEvery })}
        />
      )}
      {d.payWith === "loan" && (
        <div className="grid grid-cols-3 gap-2">
          <FireNumberField label="Down payment" prefix="$" min={0} value={d.downPayment} onChange={(downPayment) => set({ downPayment })} />
          <FireNumberField label={kind === "home" ? "Mortgage rate" : "Loan rate"} suffix="%" scale={100} min={0} max={1} value={d.rate} onChange={(rate) => set({ rate })} />
          <FireNumberField label="Term (years)" min={1} max={50} value={d.termYears} onChange={(termYears) => set({ termYears })} />
        </div>
      )}
      <p className="text-xs text-foreground-muted">
        {d.payWith === "cash" ? (
          <>The full {fmtMoney(d.price)} comes out of your cash flow that year.</>
        ) : (
          <>
            {d.payWith === "undecided" && <>Estimated with typical terms ({Math.round(typical.downShare * 100)}% down, {(typical.rate * 100).toFixed(1)}%, {typical.termYears} years). </>}
            {fmtMoney(loan.down)} down, then about <span className="font-medium text-foreground">{fmtMoney(loan.monthly)}/mo</span> for {terms.termYears} years
            ({fmtMoney(loan.totalInterest)} interest in total). Paying cash instead: {fmtMoney(d.price)} that year.
          </>
        )}
      </p>
    </>
  )
}

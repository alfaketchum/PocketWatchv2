"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanEditorProps } from "../plans-helpers"
import { applyEquity, calendarYearOf, esppIncomes, initialEquityDraft, NEW_STOCK_ACCOUNT, stockAccounts, type EquityDraft, type EquityMode } from "./equity-helpers"
import { EquityGrantFields } from "./equity-grant-fields"
import { SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

const TITLES: Record<EquityMode, string> = { rsu: "Add RSUs", options: "Add stock options", espp: "Add an ESPP" }

/** The equity tiles on Add income. */
export const EQUITY_CHOICES: { mode: EquityMode; icon: string; label: string; detail: string }[] = [
  { mode: "rsu", icon: "workspace_premium", label: "RSUs", detail: "Shares vesting each year at the live price" },
  { mode: "options", icon: "candlestick_chart", label: "Stock options", detail: "Valued with an options-pricing model; taxed as pay" },
  { mode: "espp", icon: "shopping_basket", label: "ESPP", detail: "Discounted company stock from your paycheck" },
]

type SetDraft = (change: Partial<EquityDraft>) => void
type FormProps = { d: EquityDraft; set: SetDraft; doc: PlanEditorProps["doc"] }

function StockAccountField({ d, set, doc }: FormProps) {
  const options = [
    ...stockAccounts(doc).map((a) => ({ value: a.id, label: a.name })),
    { value: NEW_STOCK_ACCOUNT, label: "New company stock account" },
  ]
  return <SelectField label="Shares go into" value={d.target} options={options} onChange={(target) => set({ target })} />
}

function KeptFields(props: FormProps) {
  const { d, set } = props
  return (
    <>
      <FireNumberField
        label="Kept as shares"
        suffix="%"
        scale={100}
        min={0}
        max={1}
        value={d.kept}
        hint="0% sells everything at vest; the cash joins the plan."
        onChange={(kept) => set({ kept })}
      />
      {d.kept > 0 && <StockAccountField {...props} />}
    </>
  )
}

function PriceGrowthField({ d, set }: FormProps) {
  return (
    <FireNumberField
      label="Price grows / yr"
      suffix="%"
      scale={100}
      min={-0.5}
      max={1}
      value={d.growth}
      hint="Before inflation. The stress test swings it 1.5× as hard as the market."
      onChange={(growth) => set({ growth })}
    />
  )
}

function RsuFields(props: FormProps) {
  const { d, set, doc } = props
  return (
    <div className="space-y-3">
      <EquityGrantFields grant={d.grant} firstYear={calendarYearOf(d.start, doc)} onChange={(change) => set({ grant: { ...d.grant, ...change } })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <TimingPicker label="Granted" value={d.start} doc={doc} onChange={(start) => set({ start })} />
        <TimingPicker label="Leave the company" value={d.end} doc={doc} allow={["planEnd", "age", "year", "milestone"]} onChange={(end) => set({ end })} />
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <PriceGrowthField {...props} />
        <KeptFields {...props} />
      </div>
      <p className="text-xs text-foreground-muted">
        Each vest is taxed as wages (income and payroll tax) at that year&apos;s price. Kept shares start with that value as their cost basis. Another
        grant on a different schedule? Add it as its own RSUs.
      </p>
    </div>
  )
}

function OptionFields(props: FormProps) {
  const { d, set, doc } = props
  return (
    <div className="space-y-3">
      <EquityGrantFields grant={d.grant} firstYear={calendarYearOf(d.start, doc)} onChange={(change) => set({ grant: { ...d.grant, ...change } })} />
      <div className="grid grid-cols-1 gap-2 items-end sm:grid-cols-2">
        <TimingPicker label="Exercised" value={d.start} doc={doc} onChange={(start) => set({ start })} />
        <PriceGrowthField {...props} />
        <KeptFields {...props} />
      </div>
      <p className="text-xs text-foreground-muted">
        Private company? Leave the ticker blank, use the latest 409A price, and the year you expect to sell.
      </p>
    </div>
  )
}

function EsppFields(props: FormProps) {
  const { d, set, doc } = props
  const salaries = esppIncomes(doc)
  if (salaries.length === 0) return <p className="text-sm text-foreground-muted">Add the salary it comes out of first.</p>
  return (
    <div className="space-y-3">
      <SelectField label="Bought from" value={d.incomeId} options={salaries.map((i) => ({ value: i.id, label: i.name }))} onChange={(incomeId) => set({ incomeId })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Share of pay" suffix="%" scale={100} min={0} max={0.15} value={d.percent} onChange={(percent) => set({ percent })} />
        <FireNumberField label="Discount" suffix="%" scale={100} min={0} max={0.15} value={d.discount} onChange={(discount) => set({ discount })} />
      </div>
      <StockAccountField {...props} />
      <p className="text-xs text-foreground-muted">
        After-tax pay buys shares at a discount; the extra value is taxed as income and shows as employer match. Purchases are capped at $25,000 of stock a
        year.
      </p>
    </div>
  )
}

const FORMS: Record<EquityMode, (props: FormProps) => ReactNode> = { rsu: RsuFields, options: OptionFields, espp: EsppFields }

function problemOf(mode: EquityMode, d: EquityDraft, doc: PlanEditorProps["doc"]): string | null {
  if (mode === "espp") {
    const income = doc.incomes.find((i) => i.id === d.incomeId)
    if (!income) return "Pick a salary"
    if (income.contributions.length >= PLAN_LIMITS.contributionsPerIncome) return "That salary has the most contributions it can hold."
    return null
  }
  if (doc.incomes.length >= PLAN_LIMITS.incomes) return "This plan has the most incomes it can hold."
  if (d.grant.shares <= 0 || d.grant.price <= 0) return "Enter the shares and price"
  return null
}

/** Pop-out for equity pay: RSU vesting, an option exercise, or an ESPP on a salary. */
export function AddEquityDialog({ mode, doc, update, onBack, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { mode: EquityMode; onBack: () => void; onClose: () => void }) {
  const [d, setDraft] = useState(() => initialEquityDraft(mode, doc))
  const set: SetDraft = (change) => setDraft((prev) => ({ ...prev, ...change }))
  const problem = problemOf(mode, d, doc)
  const Form = FORMS[mode]
  const add = () => {
    if (problem) return
    update((current) => applyEquity(mode, d, current))
    toast.success(mode === "espp" ? "Added to the salary's payroll contributions" : "Added to Income")
    onClose()
  }

  return (
    <AccountsModalShell
      title={TITLES[mode]}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onBack} className="btn-ghost text-sm mr-auto">
            ← Back
          </button>
          {problem && <span className="self-center text-xs text-foreground-muted">{problem}</span>}
          <button type="button" onClick={add} disabled={!!problem} className="btn-primary text-sm disabled:opacity-50">
            Add
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Company" value={d.company} onChange={(company) => set({ company })} />
        <Form d={d} set={set} doc={doc} />
      </div>
    </AccountsModalShell>
  )
}

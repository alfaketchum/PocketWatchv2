"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { HELOC_DEFAULTS, monthlyPayment, scheduledPayment } from "@/lib/plans/plan-debt-payments"
import { TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import { DEFAULT_CARD_APR } from "@/lib/plans/import/import-mapping"
import type { AssetKind, DebtKind, PlanDebt } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { HelocFields } from "./heloc-fields"
import { SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

const MONTHS = 12
const NO_ASSET = "none"

interface DebtChoice {
  kind: DebtKind
  icon: string
  label: string
  detail: string
  name: string
  balance: number
  rate: number
  /** Years left to pay it off; null when the payment is entered instead (cards) or set by its terms (HELOC). */
  years: number | null
  /** The asset kind it's usually against, linked by default. */
  against: AssetKind | null
}

/** Starting values only; every one is edited in the form. */
const CHOICES: DebtChoice[] = [
  { kind: "mortgage", icon: "home", label: "Mortgage", detail: "On a home you own", name: "Mortgage", balance: 300_000, rate: TYPICAL_FINANCING.home.rate, years: 25, against: "home" },
  { kind: "heloc", icon: "add_home_work", label: "HELOC", detail: "A draw on your home's equity", name: "HELOC", balance: 50_000, rate: 0.085, years: null, against: "home" },
  { kind: "auto", icon: "directions_car", label: "Auto loan", detail: "On a car you own", name: "Car loan", balance: 25_000, rate: TYPICAL_FINANCING.vehicle.rate, years: 4, against: "vehicle" },
  { kind: "student", icon: "school", label: "Student loan", detail: "Federal or private", name: "Student loan", balance: 30_000, rate: 0.065, years: 10, against: null },
  { kind: "credit", icon: "credit_card", label: "Credit card", detail: "A balance you carry", name: "Credit card", balance: 5_000, rate: DEFAULT_CARD_APR, years: null, against: null },
  { kind: "other", icon: "request_quote", label: "Other loan", detail: "Personal, family, business…", name: "Loan", balance: 10_000, rate: 0.08, years: 5, against: null },
]

function draftFor(choice: DebtChoice, assets: PlanEditorProps["doc"]["assets"]): PlanDebt {
  const asset = choice.against ? assets.find((a) => a.kind === choice.against) : undefined
  return {
    id: newItemId("debt"),
    name: choice.name,
    kind: choice.kind,
    balance: choice.balance,
    rate: choice.rate,
    monthlyPayment: choice.years ? monthlyPayment(choice.balance, choice.rate, choice.years * MONTHS) : Math.round(choice.balance * 0.03),
    start: { type: "planStart" },
    assetId: asset?.id ?? null,
    source: null,
    ...(choice.kind === "heloc" ? { heloc: HELOC_DEFAULTS } : {}),
  }
}

function ChoiceGrid({ onPick }: { onPick: (c: DebtChoice) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CHOICES.map((c) => (
        <button
          key={c.kind}
          type="button"
          onClick={() => onPick(c)}
          className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
            {c.icon}
          </span>
          <span className="text-sm font-medium text-foreground">{c.label}</span>
          <span className="text-[11px] leading-snug text-foreground-muted">{c.detail}</span>
        </button>
      ))}
    </div>
  )
}

/** Pop-out for adding a debt: pick the kind, then the few numbers that matter for it. */
export function AddDebtDialog({ doc, update, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void }) {
  const [choice, setChoice] = useState<DebtChoice | null>(null)
  const [debt, setDebt] = useState<PlanDebt | null>(null)
  const [years, setYears] = useState<number | null>(null)
  const full = doc.debts.length >= PLAN_LIMITS.debts
  const set = (change: Partial<PlanDebt>) => setDebt((d) => (d ? { ...d, ...change } : d))

  const pick = (c: DebtChoice) => {
    setChoice(c)
    setDebt(draftFor(c, doc.assets))
    setYears(c.years)
  }
  // With years left, the payment is the level one that clears the balance by then.
  const finished = debt && years ? { ...debt, monthlyPayment: monthlyPayment(debt.balance, debt.rate, years * MONTHS) } : debt
  const add = () => {
    if (!finished || full) return
    update((d) => ({ ...d, debts: [...d.debts, { ...finished, name: finished.name.trim() || choice?.name || "Loan" }] }))
    toast.success("Added to Assets & debts")
    onClose()
  }
  const assetOptions = [{ value: NO_ASSET, label: "None" }, ...doc.assets.map((a) => ({ value: a.id, label: a.name }))]

  return (
    <AccountsModalShell
      title={choice ? `Add ${choice.label.toLowerCase()}` : "Add a debt"}
      onClose={onClose}
      footer={
        choice ? (
          <>
            <button type="button" onClick={() => setChoice(null)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {full && <span className="self-center text-xs text-foreground-muted">This plan has the most debts it can hold.</span>}
            <button type="button" onClick={add} disabled={full} className="btn-primary text-sm disabled:opacity-50">
              Add
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        )
      }
    >
      {!choice && <ChoiceGrid onPick={pick} />}
      {choice && debt && finished && (
        <div className="space-y-3">
          <TextField label="Name" value={debt.name} onChange={(name) => set({ name })} />
          <div className="grid grid-cols-2 gap-2">
            <FireNumberField label={debt.kind === "heloc" ? "Amount drawn" : "Balance owed"} prefix="$" min={0} value={debt.balance} onChange={(balance) => set({ balance })} />
            <FireNumberField label="Interest" suffix="%" scale={100} min={0} max={1} value={debt.rate} onChange={(rate) => set({ rate })} />
            {years !== null && (
              <FireNumberField label="Years left" min={1} max={50} value={years} onChange={(v) => setYears(Math.min(50, Math.max(1, Math.round(v))))} />
            )}
            {debt.kind === "credit" && (
              <FireNumberField label="Monthly payment" prefix="$" min={0} value={debt.monthlyPayment} onChange={(monthlyPayment) => set({ monthlyPayment })} />
            )}
          </div>
          <TimingPicker label={debt.kind === "heloc" ? "Drawn" : "Starts"} value={debt.start} doc={doc} onChange={(start) => set({ start })} />
          {doc.assets.length > 0 && debt.kind !== "credit" && debt.kind !== "student" && (
            <SelectField
              label="Finances asset"
              value={debt.assetId ?? NO_ASSET}
              options={assetOptions}
              onChange={(v) => set({ assetId: v === NO_ASSET ? null : v })}
            />
          )}
          {debt.kind === "heloc" && <HelocFields debt={debt} doc={doc} onChange={set} />}
          {debt.kind !== "heloc" && (
            <p className="text-xs text-foreground-muted">
              {years !== null ? (
                <>
                  About <span className="font-medium text-foreground">{fmtMoney(scheduledPayment(finished, 0))}/mo</span> to pay it off in {years} years. Change the
                  payment or add extra on its card later.
                </>
              ) : finished.monthlyPayment <= (finished.balance * finished.rate) / MONTHS ? (
                <span className="text-warning">This payment doesn&apos;t cover the interest, so the balance grows.</span>
              ) : (
                <>Paid {fmtMoney(finished.monthlyPayment)} a month until it&apos;s gone.</>
              )}
            </p>
          )}
        </div>
      )}
    </AccountsModalShell>
  )
}

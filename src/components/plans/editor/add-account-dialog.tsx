"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { fmtPct } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { DEFAULT_CASH_RETURN, DEFAULT_RETURN_RATE, PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { otherReturn, shownReturn, storedReturn } from "@/lib/plans/plan-returns"
import { MILESTONE_TEMPLATES, type TemplateKey } from "@/lib/plans/milestone-templates"
import type { AccountMix, PlanAccount, TaxTreatment } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { eventsFor } from "./add-milestone-dialog"
import { TextField } from "./plan-editor-controls"

interface AccountChoice {
  key: string
  icon: string
  label: string
  detail: string
  name: string
  taxTreatment: TaxTreatment
  returnRate: number
  /** Stress-test mix when it isn't the default for its tax treatment. */
  mix?: AccountMix
}

/** Starting values only; every one is edited in the form. */
const CHOICES: AccountChoice[] = [
  { key: "cash", icon: "savings", label: "Cash", detail: "Checking, savings, money market", name: "Savings", taxTreatment: "cash", returnRate: DEFAULT_CASH_RETURN },
  { key: "brokerage", icon: "trending_up", label: "Brokerage", detail: "Taxable investing account", name: "Brokerage", taxTreatment: "taxable", returnRate: DEFAULT_RETURN_RATE },
  { key: "traditional", icon: "account_balance", label: "401(k) / IRA", detail: "Pre-tax; taxed when withdrawn", name: "401(k)", taxTreatment: "traditional", returnRate: DEFAULT_RETURN_RATE },
  { key: "roth", icon: "verified", label: "Roth", detail: "Roth IRA or 401(k); tax-free out", name: "Roth IRA", taxTreatment: "roth", returnRate: DEFAULT_RETURN_RATE },
  { key: "hsa", icon: "medical_services", label: "HSA", detail: "Health savings account", name: "HSA", taxTreatment: "hsa", returnRate: DEFAULT_RETURN_RATE },
  { key: "company", icon: "domain", label: "Company stock", detail: "Vested RSUs or ESPP shares you hold", name: "Company stock", taxTreatment: "taxable", returnRate: DEFAULT_RETURN_RATE, mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 } },
  { key: "esop", icon: "handshake", label: "ESOP", detail: "Employee stock plan; paid out after you leave", name: "ESOP", taxTreatment: "traditional", returnRate: DEFAULT_RETURN_RATE },
  { key: "education", icon: "school", label: "529", detail: "Education savings for a child", name: "529 plan", taxTreatment: "education", returnRate: DEFAULT_RETURN_RATE },
]

/** Life events that add accounts (opens the same form as on Milestones). */
export const ACCOUNT_EVENTS = eventsFor("Accounts").map((key) => MILESTONE_TEMPLATES.find((t) => t.key === key)!)

function draftFor(choice: AccountChoice): PlanAccount {
  return {
    id: newItemId("acct"),
    name: choice.name,
    taxTreatment: choice.taxTreatment,
    balance: 0,
    costBasis: null,
    returnRate: choice.returnRate,
    owner: null,
    source: null,
    ...(choice.mix ? { mix: choice.mix } : {}),
  }
}

function ChoiceTile({ icon, label, detail, onClick }: { icon: string; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-[11px] leading-snug text-foreground-muted">{detail}</span>
    </button>
  )
}

function ChoiceGrid({ onPick, onEvent }: { onPick: (c: AccountChoice) => void; onEvent: (key: TemplateKey) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CHOICES.map((c) => (
          <ChoiceTile key={c.key} icon={c.icon} label={c.label} detail={c.detail} onClick={() => onPick(c)} />
        ))}
      </div>
      {ACCOUNT_EVENTS.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Life events</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ACCOUNT_EVENTS.map((t) => (
              <ChoiceTile key={t.key} icon={t.icon} label={t.label} detail={t.creates} onClick={() => onEvent(t.key)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Pop-out for adding an account: pick the type, then its balance and return. */
export function AddAccountDialog({
  doc,
  update,
  onClose,
  onEvent,
}: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void; onEvent: (key: TemplateKey) => void }) {
  const [choice, setChoice] = useState<AccountChoice | null>(null)
  const [account, setAccount] = useState<PlanAccount | null>(null)
  const full = doc.accounts.length >= PLAN_LIMITS.accounts
  const set = (change: Partial<PlanAccount>) => setAccount((a) => (a ? { ...a, ...change } : a))

  const pick = (c: AccountChoice) => {
    setChoice(c)
    setAccount(draftFor(c))
  }
  const add = () => {
    if (!account || full) return
    update((d) => ({ ...d, accounts: [...d.accounts, { ...account, name: account.name.trim() || choice?.name || "Account" }] }))
    toast.success("Added to Accounts")
    onClose()
  }

  return (
    <AccountsModalShell
      title={choice ? `Add ${choice.label}` : "Add an account"}
      onClose={onClose}
      footer={
        choice ? (
          <>
            <button type="button" onClick={() => setChoice(null)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {full && <span className="self-center text-xs text-foreground-muted">This plan has the most accounts it can hold.</span>}
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
      {!choice && <ChoiceGrid onPick={pick} onEvent={onEvent} />}
      {choice && account && (
        <div className="space-y-3">
          <TextField label="Name" value={account.name} onChange={(name) => set({ name })} />
          <div className="grid grid-cols-2 gap-2">
            <FireNumberField label="Balance today" prefix="$" min={0} value={account.balance} onChange={(balance) => set({ balance })} />
            <FireNumberField
              label="Return / yr"
              suffix="%"
              scale={100}
              min={-0.5}
              max={1}
              value={shownReturn(account.returnRate, doc.settings)}
              hint={`≈ ${fmtPct(otherReturn(account.returnRate, doc.settings).value, 1)} ${otherReturn(account.returnRate, doc.settings).label}`}
              onChange={(v) => set({ returnRate: storedReturn(v, doc.settings) })}
            />
            {account.taxTreatment === "taxable" && (
              <FireNumberField
                label="Cost basis"
                prefix="$"
                min={0}
                value={account.costBasis ?? account.balance}
                hint="What you paid in; gains above it pay capital-gains tax."
                onChange={(costBasis) => set({ costBasis })}
              />
            )}
          </div>
          {account.taxTreatment === "education" && (
            <p className="text-xs text-foreground-muted">529s only pay college costs from a child&apos;s 529 plan (Expenses → Kids).</p>
          )}
          {account.taxTreatment === "taxable" && (
            <p className="text-xs text-foreground-muted">Short-term gains and yearly trading are set on its card once added.</p>
          )}
        </div>
      )}
    </AccountsModalShell>
  )
}

"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount } from "@/lib/plans/engine/engine-cashflow"
import type { PlanDocument, PlanSettings } from "@/lib/plans/plan-types"
import { cn } from "@/lib/utils"
import type { PlanEditorProps } from "../plans-helpers"
import { SelectField } from "./plan-editor-controls"

/** Caveats that change what the buffer can actually do in this plan. */
function bufferNotes(doc: PlanDocument, holderId: string, holderBalance: number): string {
  const notes: string[] = []
  if (holderBalance < doc.settings.cashBuffer) {
    notes.push(
      `It holds ${fmtMoney(holderBalance)} today, below the ${fmtMoney(doc.settings.cashBuffer)} target; it only grows from leftover money after taxes and spending.`,
    )
  }
  const others = doc.accounts.filter((a) => a.taxTreatment === "cash" && a.id !== holderId).length
  if (others > 0) notes.push(`Your other ${others === 1 ? "cash account isn't" : `${others} cash accounts aren't`} part of the buffer.`)
  return notes.length ? ` ${notes.join(" ")}` : ""
}

/** Plain-English description of what the buffer does in the plan right now. */
export function bufferStatus(doc: PlanDocument): { tone: "on" | "off" | "none"; text: string } {
  const account = bufferAccount(doc)
  const amount = fmtMoney(doc.settings.cashBuffer)
  if (!account) return { tone: "none", text: "No cash account yet. Add one on the Accounts tab to keep a buffer." }
  if (doc.settings.cashBuffer <= 0) return { tone: "none", text: "No buffer: set an amount above $0 to keep one." }
  if (doc.settings.protectBuffer) {
    return {
      tone: "on",
      text: `On: up to ${amount} stays in ${account.name}. When money is short, your other accounts are drawn first; the buffer is only spent once everything else is empty. Turn it off to spend cash first instead.${bufferNotes(doc, account.id, account.balance)}`,
    }
  }
  return {
    tone: "off",
    text: `Off: ${account.name} is refilled to ${amount} from leftover money, but it's spent first when money is short, because cash leads the withdrawal order. Turn it on to keep it as a last resort.${bufferNotes(doc, account.id, account.balance)}`,
  }
}

function ProtectSwitch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm font-medium text-foreground disabled:opacity-50"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-primary" : "bg-card-border")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      Protect the buffer
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", checked ? "bg-primary/10 text-primary" : "bg-background-secondary text-foreground-muted")}>
        {checked ? "On" : "Off"}
      </span>
    </button>
  )
}

/** Emergency-fund cash: how much, which account holds it, and whether shortfalls may spend it. */
export function CashBufferEditor({ doc, update }: PlanEditorProps) {
  const set = (change: Partial<PlanSettings>) => update((d) => ({ ...d, settings: { ...d.settings, ...change } }))
  const cashAccounts = doc.accounts.filter((a) => a.taxTreatment === "cash")
  const holder = bufferAccount(doc)
  const status = bufferStatus(doc)

  return (
    <InputBlock
      title="Cash buffer (emergency fund)"
      description="Cash you keep on hand. Each year, leftover money refills it before anything is invested."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
        <FireNumberField label="Amount (today's $)" prefix="$" min={0} value={doc.settings.cashBuffer} onChange={(cashBuffer) => set({ cashBuffer })} />
        {cashAccounts.length > 0 && holder && (
          <SelectField
            label="Held in"
            value={holder.id}
            options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(bufferAccountId) => set({ bufferAccountId })}
          />
        )}
      </div>
      <ProtectSwitch checked={doc.settings.protectBuffer} disabled={!holder} onChange={(protectBuffer) => set({ protectBuffer })} />
      <p
        className={cn(
          "rounded-lg px-3 py-2 text-xs",
          status.tone === "on" ? "bg-primary/10 text-foreground" : status.tone === "off" ? "bg-warning/10 text-foreground" : "bg-background-secondary text-foreground-muted",
        )}
      >
        {status.text}
      </p>
    </InputBlock>
  )
}

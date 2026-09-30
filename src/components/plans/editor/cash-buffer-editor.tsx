"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount } from "@/lib/plans/engine/engine-cashflow"
import type { PlanDocument, PlanSettings } from "@/lib/plans/plan-types"
import { cn } from "@/lib/utils"
import type { PlanEditorProps } from "../plans-helpers"
import { SelectField } from "./plan-editor-controls"

/** Short caveats: the buffer isn't full yet, other cash isn't part of it. */
function bufferNotes(doc: PlanDocument, holderId: string, holderBalance: number): string[] {
  const notes: string[] = []
  if (holderBalance < doc.settings.cashBuffer) notes.push(`Holds ${fmtMoney(holderBalance)} today; fills from leftover money.`)
  const others = doc.accounts.filter((a) => a.taxTreatment === "cash" && a.id !== holderId).length
  if (others > 0) notes.push(`${others} other cash account${others === 1 ? "" : "s"} not included.`)
  return notes
}

/** One-line description of what the buffer does now, plus caveats. */
export function bufferStatus(doc: PlanDocument): { tone: "on" | "off" | "none"; text: string; notes: string[] } {
  const account = bufferAccount(doc)
  if (!account) return { tone: "none", text: "Add a cash account to keep a buffer.", notes: [] }
  if (doc.settings.cashBuffer <= 0) return { tone: "none", text: "Set an amount to keep a buffer.", notes: [] }
  const notes = bufferNotes(doc, account.id, account.balance)
  return doc.settings.protectBuffer
    ? { tone: "on", text: "Protected: spent only after every other account is empty.", notes }
    : { tone: "off", text: "Not protected: spent first when money is short.", notes }
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
      description="First to refill, last to spend."
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-end">
        <FireNumberField label="Amount (today's $)" prefix="$" min={0} value={doc.settings.cashBuffer} onChange={(cashBuffer) => set({ cashBuffer })} />
        {cashAccounts.length > 0 && holder && (
          <SelectField
            label="Held in"
            value={holder.id}
            options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(bufferAccountId) => set({ bufferAccountId })}
          />
        )}
        <div className="pb-1.5">
          <ProtectSwitch checked={doc.settings.protectBuffer} disabled={!holder} onChange={(protectBuffer) => set({ protectBuffer })} />
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={cn(
            "font-medium",
            status.tone === "on" ? "text-primary" : status.tone === "off" ? "text-warning" : "text-foreground-muted",
          )}
        >
          {status.text}
        </span>
        {status.notes.map((n) => (
          <span key={n} className="text-foreground-muted">
            · {n}
          </span>
        ))}
      </p>
    </InputBlock>
  )
}

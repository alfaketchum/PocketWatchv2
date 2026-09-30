"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount, withdrawalSequence } from "@/lib/plans/engine/engine-cashflow"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, TaxTreatment, YearRow } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { move, OrderButtons, WaterfallColumn, WaterfallStep } from "./waterfall-step"

const TAX_NOTES: Record<TaxTreatment, string> = {
  cash: "no tax",
  taxable: "tax on gains",
  traditional: "taxed as income",
  roth: "tax-free",
  hsa: "tax-free",
  education: "college only",
}

/** Shortfall waterfall: accounts in draw order, with the protected buffer as the last resort. */
export function ShortfallWaterfall({ doc, update, example }: PlanEditorProps & { example: YearRow | null }) {
  const sequence = withdrawalSequence(doc)
  const ids = sequence.map((a) => a.id)
  const setOrder = (withdrawalOrder: string[]) => update((d) => ({ ...d, cashFlow: { ...d.cashFlow, withdrawalOrder } }))
  const buffer = doc.settings.cashBuffer > 0 ? bufferAccount(doc) : null
  const protectedBuffer: PlanAccount | null = buffer && doc.settings.protectBuffer ? buffer : null
  const has529 = doc.accounts.some((a) => a.taxTreatment === "education")
  const needed = example ? Object.values(example.shortfallBy).reduce((s, v) => s + v, 0) : 0

  return (
    <WaterfallColumn
      icon="north"
      tone="out"
      title="When money is short"
      description="Drawn top down."
      example={example ? `${example.year} · age ${example.ages[0]} · ${fmtMoney(needed)} withdrawn (incl. tax)` : "Never happens in this plan yet."}
    >
      {sequence.map((a, i) => (
        <WaterfallStep
          key={a.id}
          marker={i + 1}
          direction="out"
          last={!protectedBuffer && i === sequence.length - 1}
          title={a.name}
          subtitle={`${TAX_TREATMENT_LABELS[a.taxTreatment]} · ${TAX_NOTES[a.taxTreatment]}${
            protectedBuffer?.id === a.id ? ` · above ${fmtMoney(doc.settings.cashBuffer)} only` : ""
          }${buffer?.id === a.id && !protectedBuffer ? " · incl. buffer" : ""}`}
          amount={example?.shortfallBy[a.id]}
          actions={<OrderButtons index={i} count={sequence.length} onMove={(delta) => setOrder(move(ids, i, delta))} />}
        />
      ))}
      {protectedBuffer && (
        <WaterfallStep
          marker="lock"
          pinned
          last
          direction="out"
          title={`Last resort: ${fmtMoney(doc.settings.cashBuffer)} buffer`}
          subtitle={protectedBuffer.name}
        />
      )}
      {sequence.length === 0 && <li className="text-xs text-foreground-muted">Add accounts on the Accounts tab first.</li>}
      <li className="flex flex-wrap gap-x-3 gap-y-1 pl-9 pt-1 text-[11px] text-foreground-muted">
        {doc.cashFlow.withdrawalOrder.length > 0 && (
          <button type="button" onClick={() => setOrder([])} className="text-primary hover:underline">
            Reset to default order
          </button>
        )}
        {has529 && <span>529s excluded (college only)</span>}
      </li>
    </WaterfallColumn>
  )
}

"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { InputBlock, Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount, withdrawalSequence } from "@/lib/plans/engine/engine-cashflow"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, SurplusTarget } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { CashBufferEditor } from "./cash-buffer-editor"
import { EmptyNote } from "./plan-editor-controls"

const DEFAULT_CAP = 7_000

function move<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

function OrderButtons({ index, count, onMove }: { index: number; count: number; onMove: (delta: number) => void }) {
  return (
    <span className="flex">
      {[
        { delta: -1, icon: "arrow_upward", label: "Move up", disabled: index === 0 },
        { delta: 1, icon: "arrow_downward", label: "Move down", disabled: index === count - 1 },
      ].map((b) => (
        <button
          key={b.icon}
          type="button"
          disabled={b.disabled}
          onClick={() => onMove(b.delta)}
          aria-label={b.label}
          className="btn-ghost h-8 px-1.5 text-foreground-muted hover:text-foreground disabled:opacity-30"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            {b.icon}
          </span>
        </button>
      ))}
    </span>
  )
}

function SurplusRow({
  target,
  account,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  target: SurplusTarget
  account: PlanAccount
  index: number
  count: number
  onChange: (t: SurplusTarget) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-card-border px-3 py-2">
      <span className="text-xs tabular-nums text-foreground-muted pb-2">{index + 1}.</span>
      <div className="min-w-[8rem] flex-1 pb-2">
        <p className="text-sm font-medium text-foreground">{account.name}</p>
        <p className="text-[10px] text-foreground-muted">{TAX_TREATMENT_LABELS[account.taxTreatment]}</p>
      </div>
      {target.annualCap !== null && (
        <div className="w-32">
          <FireNumberField label="Up to / yr" prefix="$" min={0} value={target.annualCap} onChange={(annualCap) => onChange({ ...target, annualCap })} />
        </div>
      )}
      <div className="pb-2">
        <Toggle
          label="No limit"
          checked={target.annualCap === null}
          onChange={(on) => onChange({ ...target, annualCap: on ? null : DEFAULT_CAP })}
        />
      </div>
      <OrderButtons index={index} count={count} onMove={onMove} />
      <button type="button" onClick={onRemove} aria-label={`Remove ${account.name}`} className="btn-ghost h-8 px-1.5 text-foreground-muted hover:text-error">
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
          close
        </span>
      </button>
    </div>
  )
}

function SurplusOrder({ doc, update }: PlanEditorProps) {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  const targets = doc.cashFlow.surplusOrder.filter((t) => byId.has(t.accountId))
  const unused = doc.accounts.filter((a) => !targets.some((t) => t.accountId === a.id))
  const setTargets = (surplusOrder: SurplusTarget[]) => update((d) => ({ ...d, cashFlow: { ...d.cashFlow, surplusOrder } }))

  return (
    <InputBlock
      title="Where extra money goes"
      description="After the cash buffer above is topped up, leftover money goes to these accounts in order. Anything left after that goes to the first taxable account."
    >
      {targets.length === 0 && <EmptyNote>No order set: after the buffer, everything goes to your first taxable account.</EmptyNote>}
      {targets.map((t, i) => (
        <SurplusRow
          key={t.accountId}
          target={t}
          account={byId.get(t.accountId)!}
          index={i}
          count={targets.length}
          onChange={(next) => setTargets(targets.map((x) => (x.accountId === t.accountId ? next : x)))}
          onMove={(delta) => setTargets(move(targets, i, delta))}
          onRemove={() => setTargets(targets.filter((x) => x.accountId !== t.accountId))}
        />
      ))}
      {unused.length > 0 && (
        <select
          aria-label="Add account to surplus order"
          value=""
          onChange={(e) => e.target.value && setTargets([...targets, { accountId: e.target.value, annualCap: DEFAULT_CAP }])}
          className="rounded-lg border border-card-border bg-background text-xs text-foreground"
          style={{ padding: "6px 10px", fontSize: 12 }}
        >
          <option value="">+ Add account…</option>
          {unused.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
    </InputBlock>
  )
}

function WithdrawalOrder({ doc, update }: PlanEditorProps) {
  const sequence = withdrawalSequence(doc)
  const setOrder = (withdrawalOrder: string[]) => update((d) => ({ ...d, cashFlow: { ...d.cashFlow, withdrawalOrder } }))
  const ids = sequence.map((a) => a.id)
  const buffer = bufferAccount(doc)
  const protectedBuffer = buffer && doc.settings.protectBuffer && doc.settings.cashBuffer > 0 ? buffer : null

  return (
    <InputBlock
      title="Where shortfalls come from"
      description={`When spending is more than income, accounts are drawn down in this order. Traditional withdrawals pay income tax; taxable ones pay capital-gains tax on the gains.${
        protectedBuffer ? ` The protected cash buffer is skipped until every other account is empty (switch it off above to change that).` : ""
      }${doc.accounts.some((a) => a.taxTreatment === "education") ? " Education (529) accounts aren't listed: they only pay college costs." : ""}`}
    >
      {sequence.length === 0 && <EmptyNote>Add accounts first.</EmptyNote>}
      {sequence.map((a, i) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-card-border px-3 py-2">
          <span className="text-xs tabular-nums text-foreground-muted">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
            <p className="text-[10px] text-foreground-muted">
              {TAX_TREATMENT_LABELS[a.taxTreatment]}
              {protectedBuffer?.id === a.id && (
                <span className="ml-1.5 text-primary">· keeps {fmtMoney(doc.settings.cashBuffer)} protected, spent last</span>
              )}
            </p>
          </div>
          <OrderButtons index={i} count={sequence.length} onMove={(delta) => setOrder(move(ids, i, delta))} />
        </div>
      ))}
      {doc.cashFlow.withdrawalOrder.length > 0 && (
        <button type="button" onClick={() => setOrder([])} className="text-[11px] text-primary hover:underline">
          Reset to default (cash, taxable, traditional, HSA, Roth)
        </button>
      )}
    </InputBlock>
  )
}

/** Cash-flow rules: where surpluses go and which accounts cover shortfalls. */
export function CashFlowEditor(props: PlanEditorProps) {
  return (
    <div className="space-y-6">
      <CashBufferEditor {...props} />
      <SurplusOrder {...props} />
      <WithdrawalOrder {...props} />
    </div>
  )
}

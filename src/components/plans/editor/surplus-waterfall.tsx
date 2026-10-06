"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount, surplusOverflowAccount } from "@/lib/plans/engine/engine-cashflow"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import { childTransfers } from "@/lib/plans/plan-children"
import { isActive, resolveRange, timingContext } from "@/lib/plans/plan-timing"
import type { PlanAccount, PlanDocument, SurplusTarget, YearRow } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { move, OrderButtons, WaterfallColumn, WaterfallStep } from "./waterfall-step"

const DEFAULT_CAP = 7_000

interface PlannedContribution {
  id: string
  accountName: string
  /** Today's dollars per year. */
  amount: number
  exampleAmount?: number
}

/** Active 529 contributions: fixed yearly amounts taken from cash flow before anything else. */
function planContributions(doc: PlanDocument, example: YearRow | null): PlannedContribution[] {
  const ctx = timingContext(doc)
  return childTransfers(doc).map((t) => {
    const range = resolveRange(t.start, t.end, ctx)
    const active = example && isActive(range, example.index, false)
    return {
      id: t.id,
      accountName: doc.accounts.find((a) => a.id === t.accountId)?.name ?? "529",
      amount: t.amount,
      exampleAmount: active ? t.amount : undefined,
    }
  })
}

/** Example amount for an account, shown only at its first step so nothing is counted twice. */
function exampleFor(example: YearRow | null, accountId: string, seen: Set<string>): number | undefined {
  if (!example || seen.has(accountId)) return undefined
  seen.add(accountId)
  return example.surplusBy[accountId]
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="btn-ghost h-7 min-w-10 justify-center px-1 text-foreground-muted hover:text-error lg:min-w-0">
      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
        close
      </span>
    </button>
  )
}

function TargetFields({ target, onChange }: { target: SurplusTarget; onChange: (t: SurplusTarget) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-end gap-3">
      {target.annualCap !== null && (
        <div className="w-32">
          <FireNumberField label="Up to / yr" prefix="$" min={0} value={target.annualCap} onChange={(annualCap) => onChange({ ...target, annualCap })} />
        </div>
      )}
      <div className="pb-1.5">
        <Toggle
          label="No limit"
          checked={target.annualCap === null}
          onChange={(on) => onChange({ ...target, annualCap: on ? null : DEFAULT_CAP })}
        />
      </div>
    </div>
  )
}

/** Surplus waterfall: buffer top-up, then your accounts in order with caps, then the overflow rule. */
export function SurplusWaterfall({ doc, update, example }: PlanEditorProps & { example: YearRow | null }) {
  const byId = new Map(doc.accounts.map((a) => [a.id, a]))
  const targets = doc.cashFlow.surplusOrder.filter((t) => byId.has(t.accountId))
  const setTargets = (surplusOrder: SurplusTarget[]) => update((d) => ({ ...d, cashFlow: { ...d.cashFlow, surplusOrder } }))
  const buffer = doc.settings.cashBuffer > 0 ? bufferAccount(doc) : null
  const uncapped = targets.findIndex((t) => t.annualCap === null)
  const overflow: PlanAccount | null = uncapped >= 0 ? null : surplusOverflowAccount(doc)
  // 529s are funded by their child's plan, not by leftover money.
  const unused = doc.accounts.filter((a) => a.taxTreatment !== "education" && !targets.some((t) => t.accountId === a.id))
  const contributions529 = planContributions(doc, example)
  const seen = new Set<string>()
  const leftover = example ? Object.values(example.surplusBy).reduce((s, v) => s + v, 0) : 0
  let step = 0

  return (
    <WaterfallColumn
      icon="south"
      tone="in"
      title="When money is left over"
      description="Fills top down."
      example={example ? `${example.year} · age ${example.ages[0]} · ${fmtMoney(leftover)} left over` : "Never happens in this plan yet."}
    >
      {contributions529.map((c) => (
        <WaterfallStep
          key={c.id}
          marker="school"
          pinned
          direction="in"
          title={`${c.accountName} · ${fmtMoney(c.amount)}/yr`}
          subtitle="Set in Expenses → Kids · paid every year, even short ones"
          amount={c.exampleAmount}
        />
      ))}
      {buffer && (
        <WaterfallStep
          marker={++step}
          pinned
          direction="in"
          title={`Top up the cash buffer to ${fmtMoney(doc.settings.cashBuffer)}`}
          subtitle={buffer.name}
          amount={exampleFor(example, buffer.id, seen)}
        />
      )}
      {targets.map((t, i) => {
        const account = byId.get(t.accountId)!
        const unreachable = uncapped >= 0 && i > uncapped
        return (
          <WaterfallStep
            key={t.accountId}
            marker={++step}
            direction="in"
            muted={unreachable}
            last={!overflow && i === targets.length - 1}
            title={account.name}
            subtitle={
              unreachable
                ? "Not reached"
                : TAX_TREATMENT_LABELS[account.taxTreatment]
            }
            amount={exampleFor(example, account.id, seen)}
            actions={
              <>
                <OrderButtons index={i} count={targets.length} onMove={(delta) => setTargets(move(targets, i, delta))} />
                <RemoveButton label={`Remove ${account.name}`} onClick={() => setTargets(targets.filter((x) => x.accountId !== t.accountId))} />
              </>
            }
          >
            <TargetFields target={t} onChange={(next) => setTargets(targets.map((x) => (x.accountId === t.accountId ? next : x)))} />
          </WaterfallStep>
        )
      })}
      {unused.length > 0 && (
        <li className="mb-2 ml-9">
          <select
            aria-label="Add an account to fill"
            value=""
            onChange={(e) => e.target.value && setTargets([...targets, { accountId: e.target.value, annualCap: DEFAULT_CAP }])}
            className="rounded-lg border border-card-border bg-background text-xs text-foreground"
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            <option value="">+ Add account</option>
            {unused.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </li>
      )}
      {overflow && (
        <WaterfallStep
          marker="all_inclusive"
          pinned
          last
          direction="in"
          title={`Everything else → ${overflow.name}`}
          subtitle="Catch-all"
          amount={exampleFor(example, overflow.id, seen)}
        />
      )}
    </WaterfallColumn>
  )
}

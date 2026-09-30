"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { bufferAccount, surplusOverflowAccount } from "@/lib/plans/engine/engine-cashflow"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanAccount, SurplusTarget, YearRow } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { move, OrderButtons, WaterfallColumn, WaterfallStep } from "./waterfall-step"

const DEFAULT_CAP = 7_000

/** Example amount for an account, shown only at its first step so nothing is counted twice. */
function exampleFor(example: YearRow | null, accountId: string, seen: Set<string>): number | undefined {
  if (!example || seen.has(accountId)) return undefined
  seen.add(accountId)
  return example.surplusBy[accountId]
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="btn-ghost h-7 px-1 text-foreground-muted hover:text-error">
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
          label="No limit (takes everything left)"
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
  const unused = doc.accounts.filter((a) => !targets.some((t) => t.accountId === a.id))
  const seen = new Set<string>()
  const leftover = example ? Object.values(example.surplusBy).reduce((s, v) => s + v, 0) : 0
  let step = 0

  return (
    <WaterfallColumn
      icon="south"
      tone="in"
      title="When money is left over"
      description="Leftover cash fills these from the top down."
      example={
        example
          ? `Example: in ${example.year} (age ${example.ages[0]}), ${fmtMoney(leftover)} was left over. Amounts beside each step show where it went (today's $).`
          : "Your plan never has money left over, so these rules don't come into play yet."
      }
    >
      {buffer && (
        <WaterfallStep
          marker={++step}
          pinned
          direction="in"
          title={`Top up the cash buffer to ${fmtMoney(doc.settings.cashBuffer)}`}
          subtitle={`${buffer.name} · set in Cash buffer above`}
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
                ? `Never reached: ${byId.get(targets[uncapped].accountId)?.name} above takes everything left`
                : `${TAX_TREATMENT_LABELS[account.taxTreatment]} · ${t.annualCap === null ? "takes everything left" : `up to ${fmtMoney(t.annualCap)} a year`}`
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
            <option value="">+ Add an account to fill…</option>
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
          subtitle="Automatic: your first taxable account (or cash if there isn't one). Add an account with no limit above to change it."
          amount={exampleFor(example, overflow.id, seen)}
        />
      )}
    </WaterfallColumn>
  )
}

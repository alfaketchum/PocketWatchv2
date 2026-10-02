"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanAccount, PlanContribution } from "@/lib/plans/plan-types"
import { newItemId, patchItem } from "../plans-helpers"
import { SelectField } from "./plan-editor-controls"

interface Props {
  /** Equity pay: a contribution is the share kept as stock, with no match or pre-tax. */
  equity?: boolean
  contributions: PlanContribution[]
  accounts: PlanAccount[]
  onChange: (contributions: PlanContribution[]) => void
}

/** Payroll contributions (401k, HSA, …) taken from an income stream, with employer match. */
export function IncomeContributionsEditor({ equity = false, contributions, accounts, onChange }: Props) {
  const investable = accounts.filter((a) => a.taxTreatment !== "cash")
  if (investable.length === 0) return null
  const options = investable.map((a) => ({ value: a.id, label: a.name }))
  const patch = (id: string, change: Partial<PlanContribution>) => onChange(patchItem(contributions, id, change))
  const add = () => {
    const account = investable[0]
    onChange([
      ...contributions,
      {
        id: newItemId("contrib"),
        accountId: account.id,
        percent: 0.1,
        employerMatchPercent: 0,
        preTax: !equity && (account.taxTreatment === "traditional" || account.taxTreatment === "hsa"),
      },
    ])
  }

  return (
    <div className="space-y-2 rounded-lg bg-background-secondary/40 p-2.5">
      <p className="text-[11px] font-medium text-foreground-muted">{equity ? "Shares kept" : "Payroll contributions"}</p>
      {contributions.map((c) => (
        <div key={c.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto_auto] gap-2 items-end">
          <div className="col-span-2 sm:col-span-1">
            <SelectField label="Into" value={c.accountId} options={options} onChange={(accountId) => patch(c.id, { accountId })} />
          </div>
          <FireNumberField
            label={equity ? "Kept" : "You put in"}
            suffix="%"
            scale={100}
            min={0}
            max={1}
            value={c.percent}
            onChange={(percent) => patch(c.id, { percent })}
          />
          {c.discount !== undefined ? (
            <FireNumberField label="ESPP discount" suffix="%" scale={100} min={0} max={0.5} value={c.discount} onChange={(discount) => patch(c.id, { discount })} />
          ) : equity ? (
            <span />
          ) : (
            <FireNumberField
              label="Employer adds"
              suffix="%"
              scale={100}
              min={0}
              max={1}
              value={c.employerMatchPercent}
              onChange={(employerMatchPercent) => patch(c.id, { employerMatchPercent })}
            />
          )}
          <div className="pb-2">
            {!equity && c.discount === undefined && <Toggle label="Pre-tax" checked={c.preTax} onChange={(preTax) => patch(c.id, { preTax })} />}
          </div>
          <button
            type="button"
            onClick={() => onChange(contributions.filter((x) => x.id !== c.id))}
            className="btn-ghost h-[34px] px-2 text-foreground-muted hover:text-error"
            aria-label="Remove contribution"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>
      ))}
      {contributions.length < PLAN_LIMITS.contributionsPerIncome && (
        <button type="button" onClick={add} className="text-[11px] text-primary hover:underline">
          {equity ? "+ Keep shares" : "+ Add contribution"}
        </button>
      )}
    </div>
  )
}

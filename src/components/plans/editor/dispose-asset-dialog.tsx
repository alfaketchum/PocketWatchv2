"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { applyDispose, keepAsset, type DisposeChoice, type DisposeMode } from "@/lib/plans/plan-dispose"
import { deflator } from "@/lib/plans/plan-dollars"
import { expandPlan } from "@/lib/plans/plan-expand"
import { PAYMENT_MODE_LABELS } from "@/lib/plans/plan-financing"
import { inflationOf } from "@/lib/plans/plan-inflation"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PaymentMode, PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { SelectField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

/** First guesses for a downsize: a home at 60% of this one's value, or rent at about 0.4% of it a month. */
const SMALLER_SHARE = 0.6
const RENT_PER_VALUE = 0.004
const ROUND = 10_000
const YEARS_AHEAD = 5

const PAY_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }))

function modes(asset: PlanAsset): { value: DisposeMode; label: string }[] {
  return [
    { value: "sell", label: "Sell" },
    ...(asset.kind === "home" ? [{ value: "downsize" as const, label: "Downsize" }] : []),
  ]
}

function firstChoice(asset: PlanAsset, doc: PlanDocument): DisposeChoice {
  return {
    mode: "sell",
    when: asset.end.type === "planEnd" ? { type: "year", year: doc.settings.startYear + YEARS_AHEAD } : asset.end,
    downsize: { to: "buy", price: Math.round((asset.value * SMALLER_SHARE) / ROUND) * ROUND, payWith: "cash", monthlyRent: Math.round(asset.value * RENT_PER_VALUE) },
  }
}

/** What the choice does to the year it happens in, today's dollars: from the plan run with it. */
function usePreview(doc: PlanDocument, asset: PlanAsset, choice: DisposeChoice) {
  return useMemo(() => {
    const variant = applyDispose(doc, asset.id, choice, (p) => `preview-${p}`)
    const index = resolveTiming(choice.when, timingContext(variant))
    const { rows } = simulatePlan(variant)
    const row = index !== null ? rows[index] : undefined
    if (!row) return null
    const prev = rows[row.index - 1]
    // Loans you entered and loans generated from the asset's "How you'll pay" (only in the expanded plan).
    const loans = expandPlan(variant).debts.filter((d) => d.assetId === asset.id)
    const owed = loans.reduce((s, d) => s + (prev?.debtBalances[d.id] ?? d.balance), 0)
    const today = (v: number) => v / deflator(inflationOf(variant.settings), row.index, "flow")
    return { year: row.year, net: today(row.assetSales), owed: today(owed), tax: today(row.saleTax), bought: today(row.assetPurchases) }
  }, [doc, asset.id, choice])
}

function Preview({ choice, preview }: { choice: DisposeChoice; preview: NonNullable<ReturnType<typeof usePreview>> }) {
  const p = preview
  return (
    <p>
      In {p.year} you get about <span className="font-medium text-foreground">{fmtMoney(p.net)}</span>
      {p.owed > 0 && <> after paying off {fmtMoney(p.owed)} of loan</>}
      {p.tax > 0 && <>, with {fmtMoney(p.tax)} capital-gains tax</>}.
      {choice.mode === "downsize" && choice.downsize.to === "buy" && p.bought > 0 && <> {fmtMoney(p.bought)} goes into the new home.</>}
      {choice.mode === "downsize" && choice.downsize.to === "rent" && <> Rent of {fmtMoney(choice.downsize.monthlyRent)} a month starts then.</>}
    </p>
  )
}

type DialogProps = Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void }

/** Sell an asset or downsize a home, with what it does to your money that year. */
export function DisposeAssetDialog({ assetId, ...props }: DialogProps & { assetId: string }) {
  const asset = props.doc.assets.find((a) => a.id === assetId)
  return asset ? <DisposeForm asset={asset} {...props} /> : null
}

function DisposeForm({ asset, doc, update, onClose }: DialogProps & { asset: PlanAsset }) {
  const [choice, setChoice] = useState<DisposeChoice>(() => firstChoice(asset, doc))
  const preview = usePreview(doc, asset, choice)
  const set = (change: Partial<DisposeChoice>) => setChoice({ ...choice, ...change })
  const setDown = (change: Partial<DisposeChoice["downsize"]>) => setChoice({ ...choice, downsize: { ...choice.downsize, ...change } })
  const planned = asset.end.type !== "planEnd"
  const action = choice.mode === "downsize" ? "Downsize" : "Sell"

  const apply = () => {
    update((d) => applyDispose(d, asset.id, choice, newItemId))
    toast.success(choice.mode === "downsize" ? `Downsize added on Milestones` : `${asset.name} sold in the plan`)
    onClose()
  }
  const keep = () => {
    update((d) => keepAsset(d, asset.id))
    toast.success(`Keeping ${asset.name}`)
    onClose()
  }

  return (
    <AccountsModalShell
      title={asset.kind === "home" ? `Sell or downsize: ${asset.name}` : `Sell: ${asset.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm mr-auto">
            Cancel
          </button>
          {planned && (
            <button type="button" onClick={keep} className="btn-ghost text-sm">
              Keep it instead
            </button>
          )}
          <button type="button" onClick={apply} className="btn-primary text-sm">
            {action}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <ChoiceChips label="What happens" options={modes(asset)} value={choice.mode} onChange={(mode) => set({ mode })} />
        <TimingPicker label="When" value={choice.when} doc={doc} allow={["year", "age"]} onChange={(when) => set({ when })} />
        {choice.mode === "downsize" && (
          <div className="space-y-2 rounded-xl border border-card-border p-3">
            <ChoiceChips
              label="Then"
              options={[
                { value: "buy", label: "Buy a smaller home" },
                { value: "rent", label: "Rent instead" },
              ]}
              value={choice.downsize.to}
              onChange={(to) => setDown({ to })}
            />
            {choice.downsize.to === "buy" ? (
              <div className="grid grid-cols-2 gap-2">
                <FireNumberField label="New home (today's $)" prefix="$" min={0} value={choice.downsize.price} onChange={(price) => setDown({ price })} />
                <SelectField label="Pay with" value={choice.downsize.payWith} options={PAY_OPTIONS} onChange={(payWith) => setDown({ payWith })} />
              </div>
            ) : (
              <FireNumberField label="Rent per month (today's $)" prefix="$" min={0} value={choice.downsize.monthlyRent} onChange={(monthlyRent) => setDown({ monthlyRent })} />
            )}
          </div>
        )}
        <div className="rounded-xl bg-foreground/5 px-3 py-2 text-xs text-foreground-muted">
          {preview ? <Preview choice={choice} preview={preview} /> : <p>Pick a date inside the plan to see what it does.</p>}
          <p className="mt-1 text-[11px]">
            {asset.kind === "home"
                ? "A home you've lived in for 2 of the last 5 years keeps $250k of gain tax-free ($500k for couples)."
                : "The gain over what you paid is taxed as a capital gain."}
          </p>
        </div>
      </div>
    </AccountsModalShell>
  )
}

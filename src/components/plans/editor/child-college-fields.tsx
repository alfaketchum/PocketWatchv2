"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { COLLEGE_PRESET_COSTS, COLLEGE_PRESET_LABELS, DEFAULT_529_RETURN } from "@/lib/plans/plan-children"
import type { CollegePreset, PlanChild, PlanDocument } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type DocUpdater } from "../plans-helpers"
import { ChildSection } from "./child-section"

const PRESETS = (Object.keys(COLLEGE_PRESET_LABELS) as CollegePreset[]).map((value) => ({
  value,
  label: COLLEGE_PRESET_LABELS[value],
}))

interface Props {
  child: PlanChild
  doc: PlanDocument
  patch: (change: Partial<PlanChild>) => void
  update: (updater: DocUpdater) => void
}

/** College costs (with presets and tuition growth). */
export function ChildCollegeFields({ child, patch }: Pick<Props, "child" | "patch">) {
  const c = child.college
  const set = (change: Partial<PlanChild["college"]>) => patch({ college: { ...c, ...change } })
  const choosePreset = (preset: CollegePreset) =>
    set(preset === "custom" ? { preset } : { preset, annualCost: COLLEGE_PRESET_COSTS[preset] })
  return (
    <ChildSection
      title="College"
      description={`Cost of attendance for ${c.years} years from age ${c.startAge} (${child.birthYear + c.startAge}–${child.birthYear + c.startAge + c.years - 1}). Paid from the 529 first when there is one.`}
      enabled={c.enabled}
      onToggle={(enabled) => set({ enabled })}
    >
      <ChoiceChips label="College type" options={PRESETS} value={c.preset} onChange={choosePreset} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <FireNumberField
          label="Per year (today's $)"
          prefix="$"
          min={0}
          value={c.annualCost}
          onChange={(annualCost) => set({ annualCost, preset: "custom" })}
        />
        <FireNumberField label="Starts at age" min={10} max={40} value={c.startAge} onChange={(startAge) => set({ startAge })} />
        <FireNumberField label="Years" min={1} max={10} value={c.years} onChange={(years) => set({ years })} />
        <FireNumberField
          label="Cost growth / yr"
          suffix="%"
          scale={100}
          min={-0.5}
          max={1}
          value={c.growth}
          hint="Tuition usually rises faster than inflation."
          onChange={(growth) => set({ growth })}
        />
      </div>
    </ChildSection>
  )
}

/** A 529 plan: yearly contributions until college, spent on college first, tax-free. */
export function Child529Fields({ child, doc, patch, update }: Props) {
  const p = child.plan529
  const account = doc.accounts.find((a) => a.id === p.accountId) ?? null
  const setAccount = (change: { balance?: number; returnRate?: number }) =>
    account && update((d) => ({ ...d, accounts: patchItem(d.accounts, account.id, change) }))

  const toggle = (enabled: boolean) => {
    if (!enabled || account) return patch({ plan529: { ...p, enabled } })
    const id = newItemId("acct-529")
    update((d) => ({
      ...d,
      accounts: [
        ...d.accounts,
        {
          id,
          name: `${child.name}'s 529`,
          taxTreatment: "education",
          balance: 0,
          costBasis: null,
          returnRate: DEFAULT_529_RETURN,
          owner: null,
          source: null,
        },
      ],
      children: patchItem(d.children, child.id, { plan529: { ...p, enabled: true, accountId: id } }),
    }))
  }

  const until = child.birthYear + (child.college.enabled ? child.college.startAge : 18)
  return (
    <ChildSection
      title="529 plan"
      description={`Saves from your cash flow each year until ${until}. It pays ${child.name}'s college first, tax-free, and is never used for other spending.`}
      enabled={p.enabled}
      onToggle={toggle}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <FireNumberField
          label="Contribute / yr (today's $)"
          prefix="$"
          min={0}
          value={p.annualContribution}
          onChange={(annualContribution) => patch({ plan529: { ...p, annualContribution } })}
        />
        {account && (
          <>
            <FireNumberField
              label="Balance today"
              prefix="$"
              min={0}
              value={account.balance}
              onChange={(balance) => setAccount({ balance })}
            />
            <FireNumberField
              label="Return / yr"
              suffix="%"
              scale={100}
              min={-0.5}
              max={1}
              value={account.returnRate}
              onChange={(returnRate) => setAccount({ returnRate })}
            />
          </>
        )}
      </div>
      <p className="text-[11px] text-foreground-muted">
        {account ? `Held in "${account.name}" (Accounts tab). ` : ""}
        {child.college.enabled
          ? "Whatever is left after college stays in the account."
          : "Turn on College to spend it; until then it just grows."}
      </p>
    </ChildSection>
  )
}

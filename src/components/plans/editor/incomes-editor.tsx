"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { PLAN_LIMITS, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import type { EquityGrant, IncomeKind, PlanIncome, Timing } from "@/lib/plans/plan-types"
import { equityValueToday } from "@/lib/plans/engine/engine-equity"
import { EquityGrantFields } from "./equity-grant-fields"
import { calendarYearOf } from "./equity-helpers"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { DepositsEditor } from "./deposits-editor"
import { GrowthField } from "./growth-field"
import { SocialSecurityIncomeFields } from "./social-security-income-fields"
import { SocialSecurityUpgrade } from "./social-security-upgrade"
import { IncomeContributionsEditor } from "./income-contributions-editor"
import { AddButton, EditorToolbar, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { IncomesTable } from "./incomes-table"
import { AddMilestoneDialog, eventsFor } from "./add-milestone-dialog"
import type { TemplateKey } from "@/lib/plans/milestone-templates"
import { AddEquityDialog, EQUITY_CHOICES } from "./add-equity-dialog"
import type { EquityMode } from "./equity-helpers"

const KIND_OPTIONS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "business", label: "Business" },
  { value: "equity", label: "Stock pay (RSU, options)" },
  { value: "social_security", label: "Social Security" },
  { value: "pension", label: "Pension" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
]

/** Income types that usually come with a workplace plan. */
const PAYROLL_KINDS = new Set<IncomeKind>(["salary", "business", "equity"])

/** Income that may pay the same dollars every year (pensions, annuities): offered a "No raises" box. */
const FIXED_PAY_KINDS = new Set<IncomeKind>(["pension", "other"])
const NO_RAISES_HINT =
  "Pays the same dollar amount every year, like most private pensions and annuities. Inflation slowly shrinks what it buys: at 3% a year, $30,000 buys about $22,000 of today's goods after 10 years."

/** Income added from templates (each shows on the timeline: its own milestone, or a marker generated from the income). */
const INCOME_TEMPLATES: TemplateKey[] = eventsFor("Income")

/** The grant behind equity pay valued from shares and price (older equity incomes have none). */
const grantOf = (inc: PlanIncome): EquityGrant | undefined => (inc.kind === "equity" ? inc.equity : undefined)

function newIncome(hasRetirement: boolean): PlanIncome {
  const end: Timing = hasRetirement ? { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID } : { type: "planEnd" }
  return {
    id: newItemId("inc"),
    name: "Salary",
    kind: "salary",
    amount: 80_000,
    growth: null,
    start: { type: "planStart" },
    end,
    taxable: true,
    oneTime: false,
    contributions: [],
  }
}

/** Income streams: salary until retirement, Social Security later, one-time windfalls. */
export function IncomesEditor({ doc, update, view, onEditItem, viewToggle }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanIncome>) =>
    update((d) => ({ ...d, incomes: patchItem(d.incomes, id, change) }))
  // Shares or price changed: the shown amount follows (today's value).
  const patchGrant = (inc: PlanIncome, change: Partial<EquityGrant>) => {
    const equity = { ...grantOf(inc)!, ...change }
    patch(inc.id, { equity, amount: equityValueToday(equity) })
  }
  const hasRetirement = doc.milestones.some((m) => m.id === RETIREMENT_MILESTONE_ID)
  const [adding, setAdding] = useState(false)
  const [equity, setEquity] = useState<EquityMode | null>(null)
  const { isBasic } = usePlanMode()
  // Basic offers no stock pay, but an income that already is one keeps its type.
  const kindOptions = (kind: IncomeKind) => (isBasic && kind !== "equity" ? KIND_OPTIONS.filter((o) => o.value !== "equity") : KIND_OPTIONS)

  return (
    <div className="space-y-3">
      <EditorToolbar toggle={viewToggle}>
        <AddButton label="Add income" disabled={doc.incomes.length >= PLAN_LIMITS.incomes} onClick={() => setAdding(true)} />
      </EditorToolbar>
      {doc.incomes.length === 0 && <EmptyNote>No income yet. Add your salary, and later Social Security or a pension.</EmptyNote>}
      {view === "compact" ? (
        <IncomesTable doc={doc} update={update} onEditItem={onEditItem} />
      ) : doc.incomes.map((inc) => (
        <ItemCard
          key={inc.id} anchorId={planItemAnchor(inc.id)}
          title={inc.name || "Untitled income"}
          removeLabel={`Remove ${inc.name}`}
          onRemove={() => update((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== inc.id) }))}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={inc.name} onChange={(name) => patch(inc.id, { name })} />
            </div>
            <SelectField label="Type" value={inc.kind} options={kindOptions(inc.kind)} onChange={(kind) => patch(inc.id, { kind })} />
            {inc.socialSecurity ? (
              <SocialSecurityIncomeFields income={inc} doc={doc} onChange={(change) => patch(inc.id, change)} />
            ) : grantOf(inc) ? (
              <FireNumberField
                label="Price grows / yr"
                suffix="%"
                scale={100}
                min={-0.5}
                max={1}
                value={inc.growth ?? doc.settings.inflation}
                onChange={(growth) => patch(inc.id, { growth })}
              />
            ) : (
              <>
                <FireNumberField
                  label={inc.oneTime ? "Amount (today's $)" : "Per year (today's $)"}
                  prefix="$"
                  min={0}
                  value={inc.amount}
                  onChange={(amount) => patch(inc.id, { amount })}
                />
                {!isBasic && <GrowthField value={inc.growth} inflation={doc.settings.inflation} onChange={(growth) => patch(inc.id, { growth })} />}
              </>
            )}
            {doc.people.length > 1 && (
              <SelectField
                label="Whose"
                value={inc.personId ?? doc.people[0].id}
                options={doc.people.map((p) => ({ value: p.id, label: p.name }))}
                onChange={(personId) => patch(inc.id, { personId })}
              />
            )}
          </div>
          {!isBasic && grantOf(inc) && <EquityGrantFields grant={grantOf(inc)!} firstYear={calendarYearOf(inc.start, doc)} onChange={(change) => patchGrant(inc, change)} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inc.socialSecurity ? (
              <p className="self-center text-[11px] text-foreground-muted">Starts at the claiming age above.</p>
            ) : (
              <TimingPicker label={inc.oneTime ? "When" : "Starts"} value={inc.start} doc={doc} onChange={(start) => patch(inc.id, { start })} />
            )}
            {!inc.oneTime && (
              <TimingPicker
                label="Stops"
                value={inc.end}
                doc={doc}
                allow={["planEnd", "age", "year", "milestone"]}
                onChange={(end) => patch(inc.id, { end })}
              />
            )}
          </div>
          <SocialSecurityUpgrade income={inc} doc={doc} onChange={(change) => patch(inc.id, change)} />
          <div className="flex flex-wrap gap-4">
            <Toggle label="Taxable" checked={inc.taxable} onChange={(taxable) => patch(inc.id, { taxable })} />
            <Toggle label="One-time" checked={inc.oneTime} onChange={(oneTime) => patch(inc.id, { oneTime })} />
            {!inc.oneTime && FIXED_PAY_KINDS.has(inc.kind) && (
              <span className="inline-flex items-center gap-1">
                <Toggle label="No raises (same dollars every year)" checked={inc.growth === 0} onChange={(fixed) => patch(inc.id, { growth: fixed ? 0 : null })} />
                <InfoTooltip content={NO_RAISES_HINT} />
              </span>
            )}
          </div>
          {!isBasic && !inc.oneTime && (PAYROLL_KINDS.has(inc.kind) || inc.contributions.length > 0) && (
            <IncomeContributionsEditor
              equity={inc.kind === "equity"}
              contributions={inc.contributions}
              accounts={doc.accounts}
              onChange={(contributions) => patch(inc.id, { contributions })}
            />
          )}
        </ItemCard>
      ))}
      {adding && (
        <AddMilestoneDialog
          doc={doc}
          update={update}
          title="Add income"
          keys={INCOME_TEMPLATES}
          instant={[
            {
              label: "Salary or other income",
              icon: "payments",
              detail: "A regular income you set up yourself",
              onPick: () => {
                update((d) => ({ ...d, incomes: [...d.incomes, newIncome(hasRetirement)] }))
                setAdding(false)
              },
            },
            ...(isBasic ? [] : EQUITY_CHOICES).map((c) => ({
              label: c.label,
              icon: c.icon,
              detail: c.detail,
              onPick: () => {
                setAdding(false)
                setEquity(c.mode)
              },
            })),
          ]}
          onClose={() => setAdding(false)}
        />
      )}
      {equity && (
        <AddEquityDialog
          mode={equity}
          doc={doc}
          update={update}
          onBack={() => {
            setEquity(null)
            setAdding(true)
          }}
          onClose={() => setEquity(null)}
        />
      )}
      {!isBasic && <DepositsEditor doc={doc} update={update} />}
    </div>
  )
}

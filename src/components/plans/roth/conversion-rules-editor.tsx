"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { blankConversion, conversionModeLabel, heirsTaxRate } from "@/lib/plans/plan-conversions"
import type { PlanConversion, PlanDocument } from "@/lib/plans/plan-types"
import { AddButton, EmptyNote, ItemCard } from "../editor/plan-editor-controls"
import { newItemId, type DocUpdater } from "../plans-helpers"
import { ConversionRuleFields } from "./conversion-rule-fields"

const INFO =
  "Each year in its range, a rule moves money from traditional (pre-tax) accounts to a Roth after that year's required withdrawals. The amount is taxed as income that year; afterwards it grows and comes out tax-free. Rules run in order, each on top of the income the ones before it added."

/** The plan's Roth conversion rules, and the heirs' tax rate the after-tax numbers use. */
export function ConversionRulesEditor({ doc, update }: { doc: PlanDocument; update: (u: DocUpdater, opts?: { undoLabel?: string }) => void }) {
  const rules = doc.conversions ?? []
  const set = (next: PlanConversion[]) => update((d) => ({ ...d, conversions: next }))
  const blank = blankConversion(doc, "preview")
  const add = () => {
    const rule = blankConversion(doc, newItemId("conv"))
    if (rule) set([...rules, rule])
  }
  return (
    <FireSectionCard eyebrow="Conversion rules" title="Move money from traditional to Roth" info={INFO}>
      <div className="space-y-3">
        {rules.length === 0 && (
          <EmptyNote>
            {blank
              ? "No conversions yet. Add a rule, or run the optimizer above and apply what it finds."
              : "Converting needs a traditional (pre-tax) account and a Roth account for the same person. Add them on Accounts, or let the optimizer open the Roth."}
          </EmptyNote>
        )}
        {rules.map((rule) => (
          <ItemCard
            key={rule.id}
            title={
              <span>
                {rule.name} <span className="font-normal text-foreground-muted">· {conversionModeLabel(rule)}</span>
              </span>
            }
            removeLabel={`Remove ${rule.name}`}
            onRemove={() => set(rules.filter((r) => r.id !== rule.id))}
          >
            <ConversionRuleFields doc={doc} rule={rule} onChange={(next) => set(rules.map((r) => (r.id === rule.id ? next : r)))} />
          </ItemCard>
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <AddButton label="Add a conversion" onClick={add} disabled={!blank || rules.length >= PLAN_LIMITS.conversions} />
          <div className="w-full sm:w-56">
            <FireNumberField
              label="Heirs' tax rate"
              suffix="%"
              scale={100}
              min={0}
              max={1}
              value={heirsTaxRate(doc.settings)}
              hint="What heirs would pay on traditional money left at the end: after-tax net worth takes it off. Roth money passes tax-free."
              onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, heirsTaxRate: v } }))}
            />
          </div>
        </div>
      </div>
    </FireSectionCard>
  )
}

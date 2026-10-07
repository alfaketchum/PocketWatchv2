"use client"

import { ChoiceChips, Toggle } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { CONVERSION_BRACKETS, conversionDestinations, conversionSources, conversionWarnings, withMode } from "@/lib/plans/plan-conversions"
import { accountOwner } from "@/lib/plans/tax/retirement-rules-2026"
import type { ConversionMode, PlanConversion, PlanDocument } from "@/lib/plans/plan-types"
import { SelectField, TextField } from "../editor/plan-editor-controls"
import { TimingPicker } from "../editor/timing-picker"

type Mode = ConversionMode["mode"]

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "bracket", label: "Fill a bracket", hint: "Each year, convert until taxable income reaches the top of a federal bracket" },
  { value: "targetIncome", label: "Fill to an income", hint: "Each year, convert until federal taxable income reaches an amount you choose (today's dollars)" },
  { value: "fixed", label: "Fixed amount", hint: "The same amount every year" },
  { value: "convertAll", label: "Convert everything", hint: "Spread the whole balance evenly so it's all converted by the end" },
]

const DEFAULT_MODE: Record<Mode, ConversionMode> = {
  bracket: { mode: "bracket", bracketRate: 0.22 },
  targetIncome: { mode: "targetIncome", targetIncome: 100_000 },
  fixed: { mode: "fixed", amount: 25_000, amountBasis: "today" },
  convertAll: { mode: "convertAll" },
}

const IRMAA_OPTIONS = [
  { value: "none", label: "No cap" },
  { value: "0", label: "No surcharge (tier 0)" },
  { value: "1", label: "Up to tier 1" },
  { value: "2", label: "Up to tier 2" },
  { value: "3", label: "Up to tier 3" },
  { value: "4", label: "Up to tier 4" },
]

const pct = (r: number) => `${Math.round(r * 100)}%`

function ModeFields({ rule, onChange }: { rule: PlanConversion; onChange: (r: PlanConversion) => void }) {
  if (rule.mode === "bracket") {
    return (
      <SelectField
        label="Fill up to the top of"
        value={String(rule.bracketRate)}
        options={CONVERSION_BRACKETS.map((r) => ({ value: String(r), label: `the ${pct(r)} bracket` }))}
        onChange={(v) => onChange({ ...rule, bracketRate: Number(v) })}
      />
    )
  }
  if (rule.mode === "targetIncome") {
    return <FireNumberField label="Taxable income up to (today's $)" prefix="$" min={0} value={rule.targetIncome} onChange={(v) => onChange({ ...rule, targetIncome: v })} />
  }
  if (rule.mode === "fixed") {
    return (
      <div className="space-y-2">
        <FireNumberField label="Amount per year" prefix="$" min={0} value={rule.amount} onChange={(v) => onChange({ ...rule, amount: v })} />
        <ChoiceChips
          label="Amount is in"
          value={rule.amountBasis}
          options={[{ value: "today", label: "Today's $", hint: "Grows with inflation" }, { value: "nominal", label: "Fixed $", hint: "The same number every year" }]}
          onChange={(amountBasis) => onChange({ ...rule, amountBasis })}
        />
      </div>
    )
  }
  return <p className="text-xs text-foreground-muted">Each year converts what&apos;s left ÷ the years remaining, so the accounts are empty by the end.</p>
}

function AccountFields({ doc, rule, onChange }: { doc: PlanDocument; rule: PlanConversion; onChange: (r: PlanConversion) => void }) {
  const dest = doc.accounts.find((a) => a.id === rule.destAccountId)
  const owner = dest ? accountOwner(dest, doc) : undefined
  const sources = conversionSources(doc, owner)
  const destinations = conversionDestinations(doc)
  const toggle = (id: string, on: boolean) => {
    const ids = on ? [...rule.sourceAccountIds, id] : rule.sourceAccountIds.filter((x) => x !== id)
    if (ids.length > 0) onChange({ ...rule, sourceAccountIds: ids })
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <span className="block text-[11px] font-medium text-foreground-muted mb-1">From (traditional)</span>
        <div className="flex flex-col">
          {sources.map((a) => (
            <Toggle key={a.id} label={a.name} checked={rule.sourceAccountIds.includes(a.id)} onChange={(on) => toggle(a.id, on)} />
          ))}
        </div>
      </div>
      <SelectField
        label="Into (Roth)"
        value={rule.destAccountId}
        options={destinations.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(destAccountId) => {
          const next = doc.accounts.find((a) => a.id === destAccountId)
          const nextOwner = next ? accountOwner(next, doc) : undefined
          const keep = rule.sourceAccountIds.filter((id) => conversionSources(doc, nextOwner).some((a) => a.id === id))
          onChange({ ...rule, destAccountId, sourceAccountIds: keep.length > 0 ? keep : conversionSources(doc, nextOwner).map((a) => a.id) })
        }}
      />
    </div>
  )
}

/** Every field of one conversion rule, and what would stop it working. */
export function ConversionRuleFields({ doc, rule, onChange }: { doc: PlanDocument; rule: PlanConversion; onChange: (r: PlanConversion) => void }) {
  const warnings = conversionWarnings(doc, rule)
  const irmaa = rule.caps.irmaaTier == null ? "none" : String(rule.caps.irmaaTier)
  return (
    <div className="space-y-3">
      <TextField label="Name" value={rule.name} onChange={(name) => onChange({ ...rule, name })} />
      <ChoiceChips label="How much" value={rule.mode} options={MODES} onChange={(m) => onChange(withMode(rule, DEFAULT_MODE[m]))} />
      <ModeFields rule={rule} onChange={onChange} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TimingPicker label="From" value={rule.start} doc={doc} onChange={(start) => onChange({ ...rule, start })} />
        <TimingPicker label="Until" value={rule.end} doc={doc} onChange={(end) => onChange({ ...rule, end })} />
      </div>
      <AccountFields doc={doc} rule={rule} onChange={onChange} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Medicare IRMAA cap (from 63)"
          value={irmaa}
          options={IRMAA_OPTIONS}
          onChange={(v) => onChange({ ...rule, caps: { ...rule.caps, irmaaTier: v === "none" ? null : Number(v) } })}
        />
        <div className="flex items-end">
          <Toggle label="Keep long-term gains at 0%" checked={!!rule.caps.keepLtcgZero} onChange={(on) => onChange({ ...rule, caps: { ...rule.caps, keepLtcgZero: on } })} />
        </div>
      </div>
      <div>
        <span className="block text-[11px] font-medium text-foreground-muted mb-1">Pay the tax from</span>
        <ChoiceChips
          label="Pay the tax from"
          value={rule.payTaxFrom}
          options={[
            { value: "cashFlow", label: "Cash flow", hint: "Paid like any other tax, from cash and then your other accounts: the whole conversion reaches the Roth" },
            { value: "withhold", label: "The conversion", hint: "Withheld from the conversion: less reaches the Roth, and before 59½ the withheld part pays the 10% penalty" },
          ]}
          onChange={(payTaxFrom) => onChange({ ...rule, payTaxFrom })}
        />
      </div>
      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-warning">{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

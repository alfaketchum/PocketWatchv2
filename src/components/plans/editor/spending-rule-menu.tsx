"use client"

import { useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { CAPE_RULE_DEFAULT_A, CAPE_RULE_DEFAULT_B } from "@/lib/fire/fire-constants"
import { GUARDRAIL_BAND, GUARDRAIL_STEP } from "@/lib/fire/withdrawal-strategies"
import type { SpendingRule } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"
import { MENU_COLLISION_PADDING, MENU_PANEL, OptionList, type ChipOption } from "./chip-menu"

type RuleKind = SpendingRule["kind"] | "none"

const DEFAULT_RATE = 0.04

const DEFAULTS: Record<SpendingRule["kind"], SpendingRule> = {
  guardrails: { kind: "guardrails", band: GUARDRAIL_BAND, step: GUARDRAIL_STEP },
  percent: { kind: "percent", rate: DEFAULT_RATE, floor: null, ceiling: null },
  cape: { kind: "cape", a: CAPE_RULE_DEFAULT_A, b: CAPE_RULE_DEFAULT_B, floor: null, ceiling: null },
}

const LABELS: Record<RuleKind, string> = {
  none: "As planned",
  guardrails: "Guardrails",
  percent: "% of portfolio",
  cape: "CAPE-based",
}

const OPTIONS: ChipOption<RuleKind>[] = [
  { value: "none", label: LABELS.none, hint: "Spend what your expense lines say, whatever markets do.", tone: "neutral" },
  { value: "guardrails", label: LABELS.guardrails, hint: "Guyton-Klinger: cut 10% when your withdrawal rate drifts 20% above where it started, raise 10% when 20% below.", tone: "primary" },
  { value: "percent", label: LABELS.percent, hint: "Spend a set share of the portfolio each year, optionally kept between a floor and a ceiling.", tone: "success" },
  { value: "cape", label: LABELS.cape, hint: "Spend (a + b ÷ CAPE) of the portfolio: more when markets are cheap, less when they're dear.", tone: "warning" },
]

/** An optional bound (floor / ceiling) as a share of planned spending: a switch, then its value. */
function Bound({ label, value, fallback, onChange }: { label: string; value: number | null; fallback: number; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Toggle label={label} checked={value !== null} onChange={(on) => onChange(on ? fallback : null)} />
      {value !== null && (
        <FireNumberField label="% of planned spending" suffix="%" scale={100} min={0} max={5} value={value} onChange={onChange} />
      )}
    </div>
  )
}

function RuleFields({ rule, set }: { rule: SpendingRule; set: (rule: SpendingRule) => void }) {
  if (rule.kind === "guardrails") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Guardrail band" suffix="%" scale={100} min={1} max={100} value={rule.band} onChange={(band) => set({ ...rule, band })} />
        <FireNumberField label="Cut / raise by" suffix="%" scale={100} min={1} max={100} value={rule.step} onChange={(step) => set({ ...rule, step })} />
      </div>
    )
  }
  const bounds = (
    <div className="grid grid-cols-2 gap-2">
      <Bound label="Floor" value={rule.floor} fallback={0.8} onChange={(floor) => set({ ...rule, floor })} />
      <Bound label="Ceiling" value={rule.ceiling} fallback={1.25} onChange={(ceiling) => set({ ...rule, ceiling })} />
    </div>
  )
  if (rule.kind === "percent") {
    return (
      <div className="space-y-2">
        <FireNumberField label="Spend each year" suffix="% of portfolio" scale={100} min={0.1} max={50} value={rule.rate} onChange={(rate) => set({ ...rule, rate })} />
        {bounds}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="a (base rate)" suffix="%" scale={100} min={0} max={10} value={rule.a} onChange={(a) => set({ ...rule, a })} />
        <FireNumberField label="b (× 1 / CAPE)" min={0} max={5} value={rule.b} onChange={(b) => set({ ...rule, b })} />
      </div>
      {bounds}
    </div>
  )
}

/**
 * Expenses toolbar: how flexible spending responds to the portfolio from retirement. Kids, home & vehicle costs and
 * one-time items always stay as planned.
 */
export function SpendingRuleMenu({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const [open, setOpen] = useState(false)
  const rule = doc.settings.spendingRule
  const set = (next: SpendingRule | undefined) => update((d) => ({ ...d, settings: { ...d.settings, spendingRule: next } }))
  const pick = (kind: RuleKind) => set(kind === "none" ? undefined : rule?.kind === kind ? rule : DEFAULTS[kind])
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn-secondary text-xs">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            tune
          </span>
          <span>
            Spending rule: <span className="font-semibold">{LABELS[rule?.kind ?? "none"]}</span>
          </span>
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            expand_more
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={4} collisionPadding={MENU_COLLISION_PADDING} className={cn(MENU_PANEL, "w-80 space-y-2 p-1")}>
          <p className="px-2 pb-0.5 pt-1.5 text-[11px] text-foreground-muted">
            From retirement, flexible spending follows your portfolio. Kids, home &amp; vehicle costs and one-time items stay as planned.
          </p>
          <OptionList label="Spending rules" options={OPTIONS} selected={rule?.kind ?? "none"} onPick={pick} />
          {rule && (
            <div className="border-t border-card-border px-2 pb-2 pt-2">
              <RuleFields rule={rule} set={set} />
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

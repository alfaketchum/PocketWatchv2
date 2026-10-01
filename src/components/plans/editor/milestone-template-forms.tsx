"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import type { TemplateKey } from "@/lib/plans/milestone-templates"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { DivorceFields } from "./divorce-fields"
import { ElderCareFields } from "./elder-care-fields"
import { InheritanceFields } from "./inheritance-fields"
import { MarriedFields } from "./married-fields"
import { PensionFields } from "./pension-fields"
import { SelectField, TextField } from "./plan-editor-controls"
import { STATE_OPTIONS } from "./plan-tax-settings"
import { PurchaseFields } from "./purchase-fields"
import { SocialSecurityFields } from "./social-security-fields"
import { IncomePicker } from "./template-income-picker"
import { SAME_STATE, WHEN_TYPES, type SetDraft, type TemplateDraft } from "./template-draft"
import { TimingPicker } from "./timing-picker"
import { WidowedFields } from "./widowed-fields"

/** The fields for one template. */
export function TemplateFields({ template, d, set, doc }: { template: TemplateKey; d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  const when = <TimingPicker label="When" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(v) => set({ when: v })} />
  const name = <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} />
  switch (template) {
    case "retire":
      return when
    case "married":
      return <MarriedFields d={d} set={set} doc={doc} />
    case "divorce":
      return <DivorceFields d={d} set={set} doc={doc} />
    case "widowed":
      return <WidowedFields d={d} set={set} doc={doc} />
    case "elderCare":
      return <ElderCareFields d={d} set={set} doc={doc} />
    case "socialSecurity":
      return <SocialSecurityFields d={d} set={set} doc={doc} />
    case "pension":
      return <PensionFields d={d} set={set} doc={doc} />
    case "child":
      return (
        <div className="grid grid-cols-2 gap-2">
          {name}
          <FireNumberField label="Birth year" min={1900} max={2200} value={d.startYear} onChange={(startYear) => set({ startYear })} />
        </div>
      )
    case "home":
    case "vehicle":
      return <PurchaseFields d={d} set={set} doc={doc} kind={template} />
    case "career":
      return (
        <>
          <IncomePicker d={d} set={set} doc={doc} />
          {name}
          {when}
          <FireNumberField label="New salary / yr (today's $)" prefix="$" min={0} value={d.amount} onChange={(amount) => set({ amount })} />
        </>
      )
    case "break":
      return (
        <>
          <IncomePicker d={d} set={set} doc={doc} />
          <div className="grid grid-cols-2 gap-2">
            <FireNumberField label="Starting in (year)" min={1900} max={2200} value={d.startYear} onChange={(startYear) => set({ startYear })} />
            <FireNumberField label="For how many years" min={1} max={20} value={d.years} onChange={(years) => set({ years })} />
          </div>
        </>
      )
    case "move":
      return (
        <>
          {name}
          {when}
          <FireNumberField
            label="Spending changes by"
            suffix="%"
            scale={100}
            min={-0.95}
            max={5}
            value={d.percent}
            hint="Negative for a cheaper place (−10 = 10% less). Kids' costs aren't affected."
            onChange={(percent) => set({ percent })}
          />
          <SelectField label="Moving to" value={d.moveTo} options={[{ value: SAME_STATE, label: "Same state" }, ...STATE_OPTIONS]} onChange={(moveTo) => set({ moveTo })} />
          {doc.settings.taxMode !== "brackets" && d.moveTo !== SAME_STATE && (
            <p className="text-[11px] text-foreground-muted">State tax applies with tax brackets (Assumptions).</p>
          )}
        </>
      )
    case "inheritance":
      return (
        <>
          {name}
          {when}
          <InheritanceFields parts={d.parts} relationship={d.relationship} decedentState={d.decedentState} doc={doc} onChange={set} />
        </>
      )
    case "windfall":
      return (
        <>
          {name}
          {when}
          <FireNumberField label="Amount (today's $)" prefix="$" min={0} value={d.amount} onChange={(amount) => set({ amount })} />
          <Toggle label="Taxable" checked={d.taxable} onChange={(taxable) => set({ taxable })} />
        </>
      )
    case "custom":
      return (
        <>
          {name}
          {when}
        </>
      )
  }
}

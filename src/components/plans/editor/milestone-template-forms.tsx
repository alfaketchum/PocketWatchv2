"use client"

import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import {
  applyBreak,
  applyCareer,
  applyChild,
  applyCustom,
  applyHome,
  applyMarried,
  applyMove,
  applyRetire,
  applyWindfall,
  applyInheritance,
  type InheritedPart,
  monthlyPayment,
  type TemplateKey,
} from "@/lib/plans/milestone-templates"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"
import { newItemId } from "../plans-helpers"
import { emptyPart, InheritanceFields } from "./inheritance-fields"
import { SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

/** Everything the template forms can edit; each template reads the fields it needs. */
export interface TemplateDraft {
  name: string
  when: Timing
  amount: number
  percent: number
  years: number
  startYear: number
  incomeId: string
  taxable: boolean
  partnerOn: boolean
  partnerName: string
  partnerBirthYear: number
  partnerIncome: number
  incomeTaxRate: number
  capitalGainsRate: number
  weddingCost: number
  price: number
  downPayment: number
  rate: number
  termYears: number
  appreciation: number
  parts: InheritedPart[]
  stateTaxRate: number
}

const DEFAULT_NAMES: Record<TemplateKey, string> = {
  retire: "Retirement",
  married: "Get married",
  child: "New baby",
  home: "Home",
  career: "New job",
  break: "Career break",
  move: "Move",
  inheritance: "Inheritance",
  windfall: "Windfall",
  custom: "",
}

export function initialDraft(key: TemplateKey, doc: PlanDocument): TemplateDraft {
  const year = doc.settings.startYear
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const firstIncome = doc.incomes.find((i) => !i.oneTime)
  return {
    name: DEFAULT_NAMES[key],
    when: key === "retire" && retirement ? retirement.timing : { type: "year", year: year + 2 },
    amount: key === "career" ? Math.round((firstIncome?.amount ?? 80_000) * 1.2) : 100_000,
    percent: -0.1,
    years: 1,
    startYear: year + 2,
    incomeId: firstIncome?.id ?? "",
    taxable: false,
    partnerOn: doc.people.length < 2,
    partnerName: "Partner",
    partnerBirthYear: doc.people[0]?.birthYear ?? year - 35,
    partnerIncome: 0,
    incomeTaxRate: doc.settings.incomeTaxRate,
    capitalGainsRate: doc.settings.capitalGainsRate,
    weddingCost: 30_000,
    price: 500_000,
    downPayment: 100_000,
    rate: 0.065,
    termYears: 30,
    appreciation: 0.03,
    parts: [emptyPart("cash")],
    stateTaxRate: 0,
  }
}

/** Apply a template's draft to the plan. */
export function applyTemplate(key: TemplateKey, d: TemplateDraft, doc: PlanDocument): PlanDocument {
  const name = d.name.trim() || DEFAULT_NAMES[key] || "Milestone"
  switch (key) {
    case "retire":
      return applyRetire(doc, d.when)
    case "married":
      return applyMarried(
        doc,
        {
          when: d.when,
          partner: d.partnerOn ? { name: d.partnerName || "Partner", birthYear: d.partnerBirthYear } : null,
          partnerIncome: d.partnerOn ? d.partnerIncome : 0,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
          weddingCost: d.weddingCost,
        },
        newItemId,
      )
    case "child":
      return applyChild(doc, name, d.startYear, newItemId)
    case "home":
      return applyHome(doc, { name, when: d.when, price: d.price, downPayment: d.downPayment, rate: d.rate, termYears: d.termYears, appreciation: d.appreciation }, newItemId)
    case "career":
      return applyCareer(doc, { incomeId: d.incomeId, when: d.when, name, amount: d.amount }, newItemId)
    case "break":
      return applyBreak(doc, { incomeId: d.incomeId, startYear: d.startYear, years: d.years }, newItemId)
    case "move":
      return applyMove(doc, { name, when: d.when, percent: d.percent }, newItemId)
    case "inheritance":
      return applyInheritance(doc, { name, when: d.when, parts: d.parts, stateTaxRate: d.stateTaxRate }, newItemId)
    case "windfall":
      return applyWindfall(doc, { name, when: d.when, amount: d.amount, taxable: d.taxable }, newItemId)
    case "custom":
      return applyCustom(doc, { name, when: d.when }, newItemId)
  }
}

/** Why Create is disabled, if it is. */
export function draftProblem(key: TemplateKey, d: TemplateDraft, doc: PlanDocument): string | null {
  if ((key === "career" || key === "break") && !doc.incomes.some((i) => i.id === d.incomeId)) return "Add an income first."
  if (key === "custom" && !d.name.trim()) return "Give it a name."
  if (key === "inheritance" && !d.parts.some((p) => p.amount > 0)) return "Enter an amount."
  return null
}

type SetDraft = (change: Partial<TemplateDraft>) => void

const WHEN_TYPES: Timing["type"][] = ["year", "age", "milestone"]

function IncomePicker({ d, set, doc }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  const options = doc.incomes.filter((i) => !i.oneTime).map((i) => ({ value: i.id, label: i.name }))
  if (options.length === 0) return <p className="text-xs text-foreground-muted">Add an income on the Income tab first.</p>
  return <SelectField label="Which income" value={d.incomeId} options={options} onChange={(incomeId) => set({ incomeId })} />
}

function MarriedFields({ d, set, doc }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  return (
    <>
      <TimingPicker label="When" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(when) => set({ when })} />
      {doc.people.length < 2 && <Toggle label="Add your partner to the plan" checked={d.partnerOn} onChange={(partnerOn) => set({ partnerOn })} />}
      {d.partnerOn && doc.people.length < 2 && (
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Partner's name" value={d.partnerName} maxLength={40} onChange={(partnerName) => set({ partnerName })} />
          <FireNumberField label="Birth year" min={1900} max={2200} value={d.partnerBirthYear} onChange={(partnerBirthYear) => set({ partnerBirthYear })} />
          <div className="col-span-2">
            <FireNumberField label="Their salary / yr (0 for none)" prefix="$" min={0} value={d.partnerIncome} onChange={(partnerIncome) => set({ partnerIncome })} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="New income tax rate" suffix="%" scale={100} min={0} max={1} value={d.incomeTaxRate} hint="Filing jointly often lowers it." onChange={(incomeTaxRate) => set({ incomeTaxRate })} />
        <FireNumberField label="New capital gains rate" suffix="%" scale={100} min={0} max={1} value={d.capitalGainsRate} onChange={(capitalGainsRate) => set({ capitalGainsRate })} />
      </div>
      <FireNumberField label="Wedding cost (0 for none)" prefix="$" min={0} value={d.weddingCost} onChange={(weddingCost) => set({ weddingCost })} />
    </>
  )
}

function HomeFields({ d, set, doc }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  const payment = monthlyPayment(Math.max(0, d.price - d.downPayment), d.rate, d.termYears * 12)
  return (
    <>
      <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
      <TimingPicker label="Buy" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(when) => set({ when })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Price (today's $)" prefix="$" min={0} value={d.price} onChange={(price) => set({ price })} />
        <FireNumberField label="Down payment" prefix="$" min={0} value={d.downPayment} onChange={(downPayment) => set({ downPayment })} />
        <FireNumberField label="Mortgage rate" suffix="%" scale={100} min={0} max={1} value={d.rate} onChange={(rate) => set({ rate })} />
        <FireNumberField label="Term (years)" min={1} max={50} value={d.termYears} onChange={(termYears) => set({ termYears })} />
      </div>
      <p className="text-xs text-foreground-muted">
        Payment about <span className="font-medium text-foreground">{fmtMoney(payment)}/mo</span>. The down payment comes out of your cash flow that year.
      </p>
    </>
  )
}

/** The fields for one template. */
export function TemplateFields({ template, d, set, doc }: { template: TemplateKey; d: TemplateDraft; set: SetDraft; doc: PlanDocument }) {
  const when = <TimingPicker label="When" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(v) => set({ when: v })} />
  const name = <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} />
  switch (template) {
    case "retire":
      return when
    case "married":
      return <MarriedFields d={d} set={set} doc={doc} />
    case "child":
      return (
        <div className="grid grid-cols-2 gap-2">
          {name}
          <FireNumberField label="Birth year" min={1900} max={2200} value={d.startYear} onChange={(startYear) => set({ startYear })} />
        </div>
      )
    case "home":
      return <HomeFields d={d} set={set} doc={doc} />
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
        </>
      )
    case "inheritance":
      return (
        <>
          {name}
          {when}
          <InheritanceFields parts={d.parts} stateTaxRate={d.stateTaxRate} doc={doc} onChange={set} />
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

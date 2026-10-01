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
  applyVehicle,
  applyMarried,
  applyDivorce,
  applyWidowed,
  applyMove,
  applyRetire,
  applyWindfall,
  applyInheritance,
  type InheritedPart,
  type TemplateKey,
} from "@/lib/plans/milestone-templates"
import { loanSummary, PAYMENT_MODE_LABELS, TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import type { PaymentMode, PlanDocument, Timing } from "@/lib/plans/plan-types"
import type { Relationship } from "@/lib/plans/tax/inheritance-tax"
import { newItemId } from "../plans-helpers"
import { emptyPart, InheritanceFields } from "./inheritance-fields"
import { DivorceFields } from "./divorce-fields"
import { personIncomeIds } from "./income-stop-picker"
import { PensionFields } from "./pension-fields"
import { SocialSecurityFields } from "./social-security-fields"
import { WidowedFields } from "./widowed-fields"
import { applyPension, applySocialSecurity } from "@/lib/plans/income-templates"
import { SelectField, TextField } from "./plan-editor-controls"
import { NO_STATE, STATE_OPTIONS } from "./plan-tax-settings"
import { TimingPicker } from "./timing-picker"

const SAME_STATE = "same"
/** Typical yearly value change once owned. */
const VEHICLE_DEPRECIATION = -0.15
const HOME_APPRECIATION = 0.03
/** Typical years a car is kept before the next one. */
const VEHICLE_REPLACE_YEARS = 10

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
  payWith: PaymentMode
  downPayment: number
  rate: number
  termYears: number
  appreciation: number
  /** Buy a vehicle: replace it every this many years (0 = keep it). */
  replaceEvery: number
  parts: InheritedPart[]
  relationship: Relationship
  decedentState: string | null
  /** Move: the new state code, NO_STATE, or SAME_STATE. */
  moveTo: string
  /** Divorce: incomes that stop, your ex's share of each account, costs and support. */
  endIncomeIds: string[]
  exShare: number
  legalCost: number
  supportPerYear: number
  /** Whose (Social Security, pension, partner passing away). */
  personId: string
  /** Social Security: monthly benefit at full retirement age. */
  monthlyAtFra: number
  /** Social Security claiming age, or a pension's starting age. */
  age: number
  /** Pension: cost-of-living raises. */
  raises: boolean
  survivorBenefit: boolean
  lifeInsurance: number
  finalCosts: number
}

const DEFAULT_NAMES: Record<TemplateKey, string> = {
  retire: "Retirement",
  married: "Get married",
  divorce: "Divorce",
  widowed: "Partner passes away",
  socialSecurity: "Social Security",
  pension: "Pension",
  child: "New baby",
  home: "Home",
  vehicle: "Car",
  career: "New job",
  break: "Career break",
  move: "Move",
  inheritance: "Inheritance",
  windfall: "Windfall",
  custom: "",
}

/** Starting price and loan for a purchase template; other templates ignore these. */
function purchaseDefaults(
  key: TemplateKey,
): Pick<TemplateDraft, "price" | "payWith" | "downPayment" | "rate" | "termYears" | "appreciation" | "replaceEvery"> {
  const vehicle = key === "vehicle"
  const price = vehicle ? 40_000 : 500_000
  const terms = TYPICAL_FINANCING[vehicle ? "vehicle" : "home"]
  return {
    price,
    payWith: "loan",
    downPayment: price * terms.downShare,
    rate: terms.rate,
    termYears: terms.termYears,
    appreciation: vehicle ? VEHICLE_DEPRECIATION : HOME_APPRECIATION,
    replaceEvery: vehicle ? VEHICLE_REPLACE_YEARS : 0,
  }
}

export function initialDraft(key: TemplateKey, doc: PlanDocument): TemplateDraft {
  const year = doc.settings.startYear
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const firstIncome = doc.incomes.find((i) => !i.oneTime)
  return {
    name: DEFAULT_NAMES[key],
    when: key === "retire" && retirement ? retirement.timing : { type: "year", year: year + 2 },
    amount: key === "career" ? Math.round((firstIncome?.amount ?? 80_000) * 1.2) : key === "pension" ? 30_000 : 100_000,
    percent: -0.1,
    years: key === "divorce" ? 5 : 1,
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
    ...purchaseDefaults(key),
    parts: [emptyPart("cash")],
    relationship: "child",
    decedentState: doc.settings.state ?? null,
    moveTo: SAME_STATE,
    endIncomeIds: personIncomeIds(doc, doc.people[1]?.id),
    exShare: 0.5,
    legalCost: 20_000,
    supportPerYear: 0,
    personId: key === "widowed" ? (doc.people[1]?.id ?? doc.people[0]?.id ?? "") : (doc.people[0]?.id ?? ""),
    monthlyAtFra: 2_000,
    age: key === "pension" ? 65 : 67,
    raises: false,
    survivorBenefit: true,
    lifeInsurance: 0,
    finalCosts: 15_000,
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
    case "divorce":
      return applyDivorce(
        doc,
        {
          when: d.when,
          endIncomeIds: d.endIncomeIds,
          exShare: d.exShare,
          legalCost: d.legalCost,
          supportPerYear: d.supportPerYear,
          supportYears: d.years,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
        },
        newItemId,
      )
    case "widowed":
      return applyWidowed(
        doc,
        {
          personId: d.personId,
          when: d.when,
          endIncomeIds: d.endIncomeIds,
          survivorBenefit: d.survivorBenefit,
          lifeInsurance: d.lifeInsurance,
          finalCosts: d.finalCosts,
          incomeTaxRate: d.incomeTaxRate,
          capitalGainsRate: d.capitalGainsRate,
        },
        newItemId,
      )
    case "socialSecurity":
      return applySocialSecurity(doc, { personId: d.personId, monthlyAtFra: d.monthlyAtFra, claimAge: d.age }, newItemId)
    case "pension":
      return applyPension(doc, { name, personId: d.personId, amount: d.amount, startAge: d.age, raises: d.raises }, newItemId)
    case "child":
      return applyChild(doc, name, d.startYear, newItemId)
    case "home":
    case "vehicle": {
      const input = {
        name, when: d.when, price: d.price, payWith: d.payWith, downPayment: d.downPayment, rate: d.rate, termYears: d.termYears,
        appreciation: d.appreciation, replaceEveryYears: key === "vehicle" && d.replaceEvery >= 1 ? Math.round(d.replaceEvery) : null,
      }
      return key === "home" ? applyHome(doc, input, newItemId) : applyVehicle(doc, input, newItemId)
    }
    case "career":
      return applyCareer(doc, { incomeId: d.incomeId, when: d.when, name, amount: d.amount }, newItemId)
    case "break":
      return applyBreak(doc, { incomeId: d.incomeId, startYear: d.startYear, years: d.years }, newItemId)
    case "move":
      return applyMove(doc, { name, when: d.when, percent: d.percent, state: d.moveTo === SAME_STATE ? undefined : d.moveTo === NO_STATE ? null : d.moveTo }, newItemId)
    case "inheritance":
      return applyInheritance(doc, { name, when: d.when, parts: d.parts, relationship: d.relationship, decedentState: d.decedentState }, newItemId)
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
  if (key === "widowed" && doc.people.length < 2) return "Add your partner first."
  if (key === "socialSecurity" && d.monthlyAtFra <= 0) return "Enter your benefit."
  if (key === "pension" && d.amount <= 0) return "Enter an amount."
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

const PAY_OPTIONS = (Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]).map((value) => ({ value, label: PAYMENT_MODE_LABELS[value] }))

function PurchaseFields({ d, set, doc, kind }: { d: TemplateDraft; set: SetDraft; doc: PlanDocument; kind: "home" | "vehicle" }) {
  const typical = TYPICAL_FINANCING[kind]
  const terms = d.payWith === "undecided" ? typical : { downShare: d.price > 0 ? d.downPayment / d.price : 0, rate: d.rate, termYears: d.termYears }
  const loan = loanSummary(d.price, terms)
  return (
    <>
      <TextField label="Name" value={d.name} onChange={(name) => set({ name })} />
      <TimingPicker label="Buy" value={d.when} doc={doc} allow={WHEN_TYPES} onChange={(when) => set({ when })} />
      <div className="grid grid-cols-2 gap-2">
        <FireNumberField label="Price (today's $)" prefix="$" min={0} value={d.price} onChange={(price) => set({ price })} />
        <SelectField label="How you'll pay" value={d.payWith} options={PAY_OPTIONS} onChange={(payWith) => set({ payWith })} />
      </div>
      {kind === "vehicle" && (
        <FireNumberField
          label="Replace every (years)"
          min={0}
          max={50}
          value={d.replaceEvery}
          hint="0 = keep it. Each time, it's sold at its value and a like one bought at today's price plus inflation."
          onChange={(replaceEvery) => set({ replaceEvery })}
        />
      )}
      {d.payWith === "loan" && (
        <div className="grid grid-cols-3 gap-2">
          <FireNumberField label="Down payment" prefix="$" min={0} value={d.downPayment} onChange={(downPayment) => set({ downPayment })} />
          <FireNumberField label={kind === "home" ? "Mortgage rate" : "Loan rate"} suffix="%" scale={100} min={0} max={1} value={d.rate} onChange={(rate) => set({ rate })} />
          <FireNumberField label="Term (years)" min={1} max={50} value={d.termYears} onChange={(termYears) => set({ termYears })} />
        </div>
      )}
      <p className="text-xs text-foreground-muted">
        {d.payWith === "cash" ? (
          <>The full {fmtMoney(d.price)} comes out of your cash flow that year.</>
        ) : (
          <>
            {d.payWith === "undecided" && <>Estimated with typical terms ({Math.round(typical.downShare * 100)}% down, {(typical.rate * 100).toFixed(1)}%, {typical.termYears} years). </>}
            {fmtMoney(loan.down)} down, then about <span className="font-medium text-foreground">{fmtMoney(loan.monthly)}/mo</span> for {terms.termYears} years
            ({fmtMoney(loan.totalInterest)} interest in total). Paying cash instead: {fmtMoney(d.price)} that year.
          </>
        )}
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
    case "divorce":
      return <DivorceFields d={d} set={set} doc={doc} />
    case "widowed":
      return <WidowedFields d={d} set={set} doc={doc} />
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

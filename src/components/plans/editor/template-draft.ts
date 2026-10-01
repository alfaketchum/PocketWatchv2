import type { InheritedPart, TemplateKey } from "@/lib/plans/milestone-templates"
import { careDefaults, surveyToToday, type CareArrangement, type CarePayer } from "@/lib/plans/elder-care"
import { projectedScoreAt } from "@/lib/plans/credit-projection"
import { TYPICAL_FINANCING, typicalTerms } from "@/lib/plans/plan-financing"
import { VEHICLE_CONDITIONS } from "@/lib/plans/vehicle-depreciation"
import type { PaymentMode, PlanDocument, Timing } from "@/lib/plans/plan-types"
import type { Relationship } from "@/lib/plans/tax/inheritance-tax"
import { emptyPart } from "./inheritance-fields"
import { personIncomeIds } from "./income-stop-picker"

export const SAME_STATE = "same"
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
  /** Buy a vehicle: its age when bought (0 = brand new), for the depreciation curve. */
  vehicleAge: number
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
  /** Elder care. */
  careState: string | null
  arrangement: CareArrangement
  yearlyCost: number
  oneTimeCost: number
  aidePerYear: number
  payer: CarePayer
  parentShare: number
  cutWork: boolean
  workKeep: number
}

export const DEFAULT_NAMES: Record<TemplateKey, string> = {
  retire: "Retirement",
  married: "Get married",
  divorce: "Divorce",
  widowed: "Partner passes away",
  elderCare: "Mom",
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
): Pick<TemplateDraft, "price" | "payWith" | "downPayment" | "rate" | "termYears" | "appreciation" | "replaceEvery" | "vehicleAge"> {
  const vehicle = key === "vehicle"
  const brandNew = VEHICLE_CONDITIONS.new
  const price = vehicle ? brandNew.price : 500_000
  const terms = TYPICAL_FINANCING[vehicle ? "vehicle" : "home"]
  return {
    price,
    payWith: "loan",
    downPayment: price * terms.downShare,
    rate: vehicle ? brandNew.loanRate : terms.rate,
    vehicleAge: brandNew.age,
    termYears: terms.termYears,
    appreciation: vehicle ? VEHICLE_DEPRECIATION : HOME_APPRECIATION,
    replaceEvery: vehicle ? VEHICLE_REPLACE_YEARS : 0,
  }
}

/** A purchase's starting rate, from the plan's projected credit score in the year it's bought, when there is one. */
function scoredRate(key: TemplateKey, doc: PlanDocument, when: Timing, fallback: number): number {
  if (key !== "home" && key !== "vehicle") return fallback
  const score = projectedScoreAt(doc, when)
  return score === null ? fallback : typicalTerms({ kind: key, vehicleAge: key === "vehicle" ? VEHICLE_CONDITIONS.new.age : undefined }, score).rate
}

export function initialDraft(key: TemplateKey, doc: PlanDocument): TemplateDraft {
  const year = doc.settings.startYear
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const firstIncome = doc.incomes.find((i) => !i.oneTime)
  const when: Timing = key === "retire" && retirement ? retirement.timing : { type: "year", year: year + 2 }
  const purchase = purchaseDefaults(key)
  return {
    name: DEFAULT_NAMES[key],
    when,
    amount: key === "career" ? Math.round((firstIncome?.amount ?? 80_000) * 1.2) : key === "pension" ? 30_000 : 100_000,
    percent: -0.1,
    years: key === "divorce" ? 5 : key === "elderCare" ? 3 : 1,
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
    ...purchase,
    rate: scoredRate(key, doc, when, purchase.rate),
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
    careState: doc.settings.state ?? null,
    arrangement: "nursingHome",
    yearlyCost: careDefaults("nursingHome", doc.settings.state, surveyToToday(doc.settings)).yearly,
    oneTimeCost: 0,
    aidePerYear: 0,
    payer: "shared",
    parentShare: 0.5,
    cutWork: false,
    workKeep: 0.5,
  }
}

export type SetDraft = (change: Partial<TemplateDraft>) => void

export const WHEN_TYPES: Timing["type"][] = ["year", "age", "milestone"]

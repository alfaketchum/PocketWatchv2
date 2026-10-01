import { CARE_COST_YEAR, careCostsFor } from "./elder-care-costs-2024"
import type { PlanDocument, PlanExpense, PlanIncome, PlanMilestone, Timing } from "./plan-types"

type IdMaker = (prefix: string) => string

/** How the parent is cared for. */
export type CareArrangement = "nursingHome" | "hybrid" | "moveIn"
/** Who pays: the parent covers it all, a share, or nothing. */
export type CarePayer = "parent" | "shared" | "you"

export const CARE_LABELS: Record<CareArrangement, string> = { nursingHome: "Nursing home", hybrid: "Assisted living / help at home", moveIn: "Move them in" }

/** Hours a week of paid help: part-time alongside family (moving them in), or most days at their own home. */
export const AIDE_HOURS_PART_TIME = 15
export const AIDE_HOURS_AT_HOME = 30
const WEEKS = 52
/** Rough extra household costs when a parent moves in (food, utilities, supplies), and one-time home changes. */
const MOVE_IN_HOUSEHOLD = 12_000
const MOVE_IN_HOME_CHANGES = 15_000

/** Survey dollars → the plan's today's dollars: grown at the plan's inflation from the survey year to the plan's start. */
export function surveyToToday(settings: { inflation: number; startYear: number }): number {
  return Math.pow(1 + settings.inflation, Math.max(0, settings.startYear - CARE_COST_YEAR))
}

/** What paid help costs a year at the state's hourly rate (survey dollars × `uplift`). */
export function aideYearly(state: string | null | undefined, hoursPerWeek: number, uplift = 1): number {
  return Math.round(careCostsFor(state).aideHourly * hoursPerWeek * WEEKS * uplift)
}

/**
 * Starting costs for an arrangement where the parent lives: state survey medians brought to today's dollars by
 * `uplift` (see surveyToToday). Move-in household costs are rough estimates already in today's dollars.
 */
export function careDefaults(arrangement: CareArrangement, state: string | null | undefined, uplift = 1): { yearly: number; oneTime: number; hint: string } {
  const survey = careCostsFor(state)
  const costs = { nursingHome: Math.round(survey.nursingHome * uplift), assistedLiving: Math.round(survey.assistedLiving * uplift) }
  const where = state ? `${state} median` : "national average"
  if (arrangement === "nursingHome") {
    return { yearly: costs.nursingHome, oneTime: 0, hint: `Private room, ${where} (${CARE_COST_YEAR} Cost of Care Survey, brought to today's dollars).` }
  }
  if (arrangement === "hybrid") {
    return {
      yearly: costs.assistedLiving,
      oneTime: 0,
      hint: `Assisted living, one bedroom, ${where} (${CARE_COST_YEAR} survey, in today's dollars). Paid help ${AIDE_HOURS_AT_HOME} hours a week at their own home instead runs about $${aideYearly(state, AIDE_HOURS_AT_HOME, uplift).toLocaleString("en-US")} a year.`,
    }
  }
  return {
    yearly: MOVE_IN_HOUSEHOLD,
    oneTime: MOVE_IN_HOME_CHANGES,
    hint: "Extra household costs (food, utilities, supplies) and one-time home changes (ramps, bathroom, bedroom) are rough estimates. Add paid help below.",
  }
}

export interface ElderCareInput {
  parentName: string
  arrangement: CareArrangement
  startYear: number
  years: number
  /** Care cost per year, today's dollars (the whole cost, before anyone's share). */
  yearlyCost: number
  /** One-time cost at the start (home changes when moving them in). */
  oneTimeCost: number
  /** Paid help on top (moving them in), per year. */
  aidePerYear: number
  payer: CarePayer
  /** Share the parent pays when shared (0–1). */
  parentShare: number
  /** Cut back your own work during care: the income and the share of it you keep (0–1); null to keep working as is. */
  workCut: { incomeId: string; keep: number } | null
}

/** The share of the cost you pay. */
export function yourShare(input: Pick<ElderCareInput, "payer" | "parentShare">): number {
  if (input.payer === "parent") return 0
  if (input.payer === "you") return 1
  return Math.min(1, Math.max(0, 1 - input.parentShare))
}

const at = (milestoneId: string): Timing => ({ type: "milestone", milestoneId })

/** Your part of the care costs as expenses between the two milestones. */
function careExpenses(input: ElderCareInput, startId: string, endId: string, newId: IdMaker): PlanExpense[] {
  const share = yourShare(input)
  const label = input.parentName.trim() || "Parent"
  const suffix = share < 1 ? ` (your ${Math.round(share * 100)}%)` : ""
  const line = (name: string, amount: number, oneTime: boolean): PlanExpense => ({
    id: newId("exp"),
    name: `${name}${suffix}`,
    category: "Elder care",
    amount: Math.round(amount * share),
    growth: null,
    start: at(startId),
    end: oneTime ? at(startId) : at(endId),
    oneTime,
    origin: startId,
  })
  const yearly = input.yearlyCost + (input.arrangement === "moveIn" ? input.aidePerYear : 0)
  return [
    ...(yearly * share > 0 ? [line(`${label}'s care: ${CARE_LABELS[input.arrangement].toLowerCase()}`, yearly, false)] : []),
    ...(input.oneTimeCost * share > 0 ? [line(`${label}: home changes`, input.oneTimeCost, true)] : []),
  ]
}

/** Work cut back during care: the income pays `keep` of itself from the start, then resumes in full. */
function workCut(doc: PlanDocument, input: ElderCareInput, startId: string, endId: string, newId: IdMaker): PlanIncome[] | null {
  const old = input.workCut ? doc.incomes.find((i) => i.id === input.workCut?.incomeId) : undefined
  if (!old || !input.workCut || input.workCut.keep >= 1) return null
  const reduced: PlanIncome = { ...old, id: newId("inc"), name: `${old.name} (reduced for care)`, amount: Math.round(old.amount * input.workCut.keep), start: at(startId), end: at(endId), origin: startId }
  const resumed: PlanIncome = { ...old, id: newId("inc"), start: at(endId), end: old.end, origin: startId, continues: old.id }
  return [reduced, resumed]
}

/**
 * Elder care for a parent: a start and an end milestone, your share of the care costs (nursing home, a hybrid
 * of paid and family care, or moving them in), and optionally cutting back your work while it lasts.
 */
export function applyElderCare(doc: PlanDocument, input: ElderCareInput, icon: string, newId: IdMaker): PlanDocument {
  const startId = newId("ms-eldercare")
  const endId = newId("ms-eldercare-end")
  const label = input.parentName.trim() || "Parent"
  const milestones: PlanMilestone[] = [
    { id: startId, name: `${label}'s care begins`, kind: "custom", icon, timing: { type: "year", year: input.startYear } },
    // Timed from care's start, so moving it keeps its length.
    { id: endId, name: `${label}'s care ends`, kind: "custom", icon, timing: { type: "milestone", milestoneId: startId, offsetYears: Math.max(1, input.years) }, origin: startId },
  ]
  const work = workCut(doc, input, startId, endId, newId)
  const incomes = work ? [...doc.incomes.map((i) => (i.id === input.workCut?.incomeId ? { ...i, end: at(startId) } : i)), ...work] : doc.incomes
  return {
    ...doc,
    milestones: [...doc.milestones, ...milestones],
    incomes,
    expenses: [...doc.expenses, ...careExpenses(input, startId, endId, newId)],
  }
}

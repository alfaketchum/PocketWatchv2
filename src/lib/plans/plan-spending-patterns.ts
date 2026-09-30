import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PatternPreset, PlanDocument, PlanExpense, SpendingPattern } from "./plan-types"

export const PATTERN_LABELS: Record<PatternPreset, string> = {
  steady: "Steady",
  gogo: "Go-go",
  tapering: "Tapering",
  rising: "Rising",
  custom: "Custom",
}

export const PATTERN_HINTS: Record<PatternPreset, string> = {
  steady: "Same as today, rising only with inflation",
  gogo: "120% for the first 10 years of retirement, 80% the next 10, then 50%",
  tapering: "1% less each year of retirement (down to 60%)",
  rising: "2.5% a year faster than inflation from 65 (up to 2.5×)",
  custom: "Your own phases by age",
}

/** Go-go, slow-go, no-go: years into retirement where each phase starts, and its spending share. */
const GOGO_PHASES = [
  { afterYears: 0, factor: 1.2 },
  { afterYears: 10, factor: 0.8 },
  { afterYears: 20, factor: 0.5 },
]
const TAPER_PER_YEAR = 0.01
const TAPER_FLOOR = 0.6
const RISING_FROM_AGE = 65
const RISING_PER_YEAR = 0.025
const RISING_CAP = 2.5

/**
 * Share of today's amount spent at `age` (on top of inflation). Patterns hinge on the retirement age:
 * nothing changes before it, so an early retiree's go-go years start early too. Rising follows age.
 */
export function patternFactor(pattern: SpendingPattern | undefined, age: number, retireAge: number | null): number {
  const preset = pattern?.preset ?? "steady"
  if (preset === "rising") return Math.min(RISING_CAP, Math.pow(1 + RISING_PER_YEAR, Math.max(0, age - RISING_FROM_AGE)))
  if (preset === "custom") {
    const phases = [...(pattern?.phases ?? [])].sort((a, b) => a.fromAge - b.fromAge)
    return [...phases].reverse().find((p) => age >= p.fromAge)?.factor ?? 1
  }
  if (preset === "steady" || retireAge === null || age < retireAge) return 1
  const years = age - retireAge
  if (preset === "tapering") return Math.max(TAPER_FLOOR, 1 - TAPER_PER_YEAR * years)
  return [...GOGO_PHASES].reverse().find((p) => years >= p.afterYears)?.factor ?? 1
}

/** The primary person's retirement age, or null when the plan has no retirement inside it. */
export function retirementAge(doc: PlanDocument): number | null {
  const person = doc.people[0]
  const retirement = doc.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID || m.kind === "retirement")
  if (!person || !retirement) return null
  const index = resolveTiming(retirement.timing, timingContext(doc))
  return index === null ? null : ageAtStart(person, doc.settings) + index
}

/** Go-go phases as fixed ages: the starting point when switching a line to Custom. */
export function customFromGogo(retireAge: number | null): { fromAge: number; factor: number }[] {
  const base = retireAge ?? 65
  return GOGO_PHASES.map((p) => ({ fromAge: Math.round(base + p.afterYears), factor: p.factor }))
}

/** Which pattern suits a spending category in a typical retirement. */
const TYPICAL: { preset: PatternPreset; words: string[] }[] = [
  { preset: "gogo", words: ["travel", "vacation", "entertainment", "dining", "restaurant", "recreation", "hobbies", "leisure"] },
  { preset: "rising", words: ["health", "medical", "doctor", "pharmacy", "dental"] },
  { preset: "tapering", words: ["shopping", "clothing", "transport", "personal care", "gifts", "electronics"] },
]

export function typicalPattern(expense: Pick<PlanExpense, "name" | "category">): PatternPreset {
  const text = `${expense.category ?? ""} ${expense.name}`.toLowerCase()
  return TYPICAL.find((t) => t.words.some((w) => text.includes(w)))?.preset ?? "steady"
}

/** Sets every recurring line to the pattern its category typically follows in retirement. */
export function applyTypicalPatterns(doc: PlanDocument): { doc: PlanDocument; changed: number } {
  let changed = 0
  const expenses = doc.expenses.map((e) => {
    if (e.oneTime) return e
    const preset = typicalPattern(e)
    if ((e.pattern?.preset ?? "steady") === preset) return e
    changed++
    return { ...e, pattern: { preset } }
  })
  return { doc: { ...doc, expenses }, changed }
}

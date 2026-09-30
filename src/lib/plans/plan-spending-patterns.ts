import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PatternPreset, PlanDocument, PlanExpense, SpendingPattern, SpendingStage } from "./plan-types"

export const PATTERN_LABELS: Record<PatternPreset, string> = {
  steady: "Steady",
  gogo: "Go-go",
  tapering: "Tapering",
  rising: "Rising",
  custom: "Custom",
}

export const PATTERN_HINTS: Record<PatternPreset, string> = {
  steady: "stays level (rising only with inflation)",
  gogo: "120% for 10 years, 80% the next 10, then 50%",
  tapering: "1% less each year, down to 60%",
  rising: "2.5% a year faster than inflation, up to 2.5×",
  custom: "your own shares of today's amount by age",
}

/** Go-go, slow-go, no-go: years into the stage where each phase starts, and its share. */
const GOGO_PHASES = [
  { afterYears: 0, factor: 1.2 },
  { afterYears: 10, factor: 0.8 },
  { afterYears: 20, factor: 0.5 },
]
const TAPER_PER_YEAR = 0.01
const TAPER_FLOOR = 0.6
const RISING_PER_YEAR = 0.025
const RISING_CAP = 2.5

/** A stage's share `years` into it (custom phases are by age and are shares of today's amount). */
function stageFactor(stage: SpendingStage, years: number, age: number): number {
  switch (stage.preset) {
    case "steady":
      return 1
    case "gogo":
      return [...GOGO_PHASES].reverse().find((p) => years >= p.afterYears)?.factor ?? 1
    case "tapering":
      return Math.max(TAPER_FLOOR, 1 - TAPER_PER_YEAR * years)
    case "rising":
      return Math.min(RISING_CAP, Math.pow(1 + RISING_PER_YEAR, years))
    case "custom": {
      const phases = [...(stage.phases ?? [])].sort((a, b) => b.fromAge - a.fromAge)
      return phases.find((p) => age >= p.fromAge)?.factor ?? 1
    }
  }
}

/** Age the second stage starts: the plan's retirement age or the chosen age (null = no switch). */
export function switchAge(pattern: SpendingPattern | undefined, retireAge: number | null): number | null {
  const then = pattern?.then
  if (!then) return null
  return then.at === "retirement" ? retireAge : (then.age ?? retireAge)
}

/**
 * Share of today's amount spent at `age` (on top of inflation). The first stage runs from now; the second,
 * from its switch, carries on from where the first left off (custom phases are shares of today's amount).
 */
export function patternFactor(pattern: SpendingPattern | undefined, age: number, retireAge: number | null, nowAge: number): number {
  if (!pattern) return 1
  const at = switchAge(pattern, retireAge)
  if (at === null || age < at || !pattern.then) return stageFactor(pattern, age - nowAge, age)
  const level = pattern.then.preset === "custom" ? 1 : stageFactor(pattern, Math.max(0, at - nowAge), at)
  return level * stageFactor(pattern.then, age - at, age)
}

/** The primary person's retirement age, or null when the plan has no retirement inside it. */
export function retirementAge(doc: PlanDocument): number | null {
  const person = doc.people[0]
  const retirement = doc.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID || m.kind === "retirement")
  if (!person || !retirement) return null
  const index = resolveTiming(retirement.timing, timingContext(doc))
  return index === null ? null : ageAtStart(person, doc.settings) + index
}

/** Go-go phases as fixed ages from `start`: the starting point when switching a stage to Custom. */
export function customFrom(start: number): { fromAge: number; factor: number }[] {
  return GOGO_PHASES.map((p) => ({ fromAge: Math.round(start + p.afterYears), factor: p.factor }))
}

/** Which pattern suits a spending category after retirement. */
const TYPICAL: { preset: PatternPreset; words: string[] }[] = [
  { preset: "gogo", words: ["travel", "vacation", "entertainment", "dining", "restaurant", "recreation", "hobbies", "leisure"] },
  { preset: "rising", words: ["health", "medical", "doctor", "pharmacy", "dental"] },
  { preset: "tapering", words: ["shopping", "clothing", "transport", "personal care", "gifts", "electronics"] },
]

/** Healthcare costs climb with age rather than with retirement. */
const RISING_FROM_AGE = 65

export function typicalPattern(expense: Pick<PlanExpense, "name" | "category">): SpendingPattern | undefined {
  const text = `${expense.category ?? ""} ${expense.name}`.toLowerCase()
  const preset = TYPICAL.find((t) => t.words.some((w) => text.includes(w)))?.preset
  if (!preset) return undefined
  return preset === "rising"
    ? { preset: "steady", then: { preset, at: "age", age: RISING_FROM_AGE } }
    : { preset: "steady", then: { preset, at: "retirement" } }
}

/** Sets every recurring line to the pattern its category typically follows (steady until the switch). */
export function applyTypicalPatterns(doc: PlanDocument): { doc: PlanDocument; changed: number } {
  let changed = 0
  const expenses = doc.expenses.map((e) => {
    if (e.oneTime) return e
    const pattern = typicalPattern(e)
    if (JSON.stringify(pattern) === JSON.stringify(e.pattern)) return e
    changed++
    return pattern ? { ...e, pattern } : { ...e, pattern: undefined }
  })
  return { doc: { ...doc, expenses }, changed }
}

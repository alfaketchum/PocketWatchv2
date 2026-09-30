import { RETIREMENT_MILESTONE_ID } from "./plan-constants"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PatternPreset, PatternProfile, PlanDocument, PlanExpense, SpendingPattern, SpendingStage } from "./plan-types"

export type { PatternProfile }

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

/** Category words for each kind of spending. */
const FUN = ["travel", "vacation", "entertainment", "dining", "restaurant", "recreation", "hobbies", "leisure"]
const HEALTH = ["health", "medical", "doctor", "pharmacy", "dental"]
const DISCRETIONARY = ["shopping", "clothing", "transport", "personal care", "gifts", "electronics"]
const ESSENTIAL = ["housing", "rent", "mortgage", "utilities", "bills", "groceries", "insurance"]

type SpendKind = "fun" | "health" | "discretionary" | "essential" | "other"

function kindOf(expense: Pick<PlanExpense, "name" | "category">): SpendKind {
  const text = `${expense.category ?? ""} ${expense.name}`.toLowerCase()
  const has = (words: string[]) => words.some((w) => text.includes(w))
  if (has(HEALTH)) return "health"
  if (has(FUN)) return "fun"
  if (has(DISCRETIONARY)) return "discretionary"
  if (has(ESSENTIAL)) return "essential"
  return "other"
}

/** Healthcare costs climb with age rather than with retirement. */
const RISING_FROM_AGE = 65

export const PATTERN_PROFILES: { key: PatternProfile; label: string; hint: string }[] = [
  {
    key: "typical",
    label: "Typical retirement",
    hint: "Steady until you retire; then travel, dining and fun go-go, everyday extras taper, healthcare rises from 65",
  },
  {
    key: "frontload",
    label: "Front-load the fun",
    hint: "Travel, dining and fun go-go from today (do it while you can); extras taper after retiring; healthcare rises from 65",
  },
  {
    key: "conservative",
    label: "Conservative",
    hint: "Assume nothing gets cheaper: everything steady, healthcare rises from 65",
  },
  {
    key: "frugal",
    label: "Frugal later",
    hint: "Housing, bills and groceries hold; everything else tapers after retiring; healthcare rises from 65",
  },
  { key: "reset", label: "All steady", hint: "Clear every pattern: each line rises only with inflation" },
]

const STEADY_THEN = (preset: PatternPreset): SpendingPattern => ({ preset: "steady", then: { preset, at: "retirement" } })
const HEALTH_RISING: SpendingPattern = { preset: "steady", then: { preset: "rising", at: "age", age: RISING_FROM_AGE } }

/** The pattern a profile gives a line (undefined = steady). */
export function profilePattern(profile: PatternProfile, expense: Pick<PlanExpense, "name" | "category">): SpendingPattern | undefined {
  if (profile === "reset") return undefined
  const kind = kindOf(expense)
  if (kind === "health") return HEALTH_RISING
  switch (profile) {
    case "typical":
      return kind === "fun" ? STEADY_THEN("gogo") : kind === "discretionary" ? STEADY_THEN("tapering") : undefined
    case "frontload":
      return kind === "fun" ? { preset: "gogo" } : kind === "discretionary" ? STEADY_THEN("tapering") : undefined
    case "conservative":
      return undefined
    case "frugal":
      return kind === "essential" ? undefined : STEADY_THEN("tapering")
  }
}

const samePattern = (a: SpendingPattern | undefined, b: SpendingPattern | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Applies a profile to every recurring line and remembers it on the plan; returns how many lines changed. */
export function applyProfile(doc: PlanDocument, profile: PatternProfile): { doc: PlanDocument; changed: number } {
  let changed = 0
  const expenses = doc.expenses.map((e) => {
    if (e.oneTime) return e
    const pattern = profilePattern(profile, e)
    if (samePattern(pattern, e.pattern)) return e
    changed++
    return { ...e, pattern }
  })
  return { doc: { ...doc, settings: { ...doc.settings, spendingProfile: profile }, expenses }, changed }
}

/** The plan's profile, and whether any line has since been changed away from it. */
export function profileStatus(doc: PlanDocument): { profile: PatternProfile | null; edited: boolean } {
  const profile = doc.settings.spendingProfile ?? null
  if (!profile) return { profile: null, edited: false }
  const edited = doc.expenses.some((e) => !e.oneTime && !samePattern(profilePattern(profile, e), e.pattern))
  return { profile, edited }
}

/** The pattern a new line starts with: the plan's profile applied to its category (none when no profile). */
export function patternForNewLine(doc: PlanDocument, expense: Pick<PlanExpense, "name" | "category">): SpendingPattern | undefined {
  const profile = doc.settings.spendingProfile
  return profile ? profilePattern(profile, expense) : undefined
}

/** A custom growth rate above inflation plus Rising counts the extra growth twice. */
export function growthOverlapsRising(expense: Pick<PlanExpense, "growth" | "pattern">, inflation: number): boolean {
  const rising = expense.pattern?.preset === "rising" || expense.pattern?.then?.preset === "rising"
  return rising && expense.growth !== null && expense.growth > inflation
}

/** The warning for a line whose own growth and Rising both push it up, or null. */
export function overlapWarning(expense: Pick<PlanExpense, "growth" | "pattern">, inflation: number): string | null {
  if (!growthOverlapsRising(expense, inflation) || expense.growth === null) return null
  const growth = `${(expense.growth * 100).toFixed(1)}%`
  return `Growth is set to ${growth} and this line also uses Rising, so its extra growth counts twice. Set growth back to inflation, or pick another pattern.`
}

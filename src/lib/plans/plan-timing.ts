import { MAX_PLAN_YEARS } from "./plan-constants"
import type { PlanDocument, PlanPerson, PlanSettings, Timing } from "./plan-types"

/** Milestones can point at other milestones; deeper chains are treated as cycles. */
const MAX_MILESTONE_DEPTH = 8

/** Age in whole years at the plan's start month. */
export function ageAtStart(person: PlanPerson, settings: PlanSettings): number {
  const beforeBirthday = settings.startMonth < person.birthMonth ? 1 : 0
  return settings.startYear - person.birthYear - beforeBirthday
}

/** Number of simulated years: until the first person reaches `endAge`. */
export function planLength(doc: PlanDocument): number {
  const first = doc.people[0]
  const years = first ? doc.settings.endAge - ageAtStart(first, doc.settings) : MAX_PLAN_YEARS
  return Math.min(MAX_PLAN_YEARS, Math.max(1, years))
}

export interface TimingContext {
  doc: PlanDocument
  length: number
}

export function timingContext(doc: PlanDocument): TimingContext {
  return { doc, length: planLength(doc) }
}

/**
 * Year index (0 = first plan year) a timing points at. May fall outside [0, length];
 * returns null when it can't be resolved (missing person or milestone, or a cycle).
 */
export function resolveTiming(timing: Timing, ctx: TimingContext, depth = 0): number | null {
  switch (timing.type) {
    case "planStart":
      return 0
    case "planEnd":
      return ctx.length
    case "year":
      return timing.year - ctx.doc.settings.startYear
    case "age": {
      const person = ctx.doc.people.find((p) => p.id === timing.personId)
      return person ? timing.age - ageAtStart(person, ctx.doc.settings) : null
    }
    case "milestone": {
      if (depth >= MAX_MILESTONE_DEPTH) return null
      const milestone = ctx.doc.milestones.find((m) => m.id === timing.milestoneId)
      return milestone ? resolveTiming(milestone.timing, ctx, depth + 1) : null
    }
  }
}

export interface ResolvedRange {
  start: number
  end: number
}

/** [start, end) year range; unresolvable ends fall back to the plan's bounds. */
export function resolveRange(start: Timing, end: Timing, ctx: TimingContext): ResolvedRange {
  return {
    start: resolveTiming(start, ctx) ?? 0,
    end: resolveTiming(end, ctx) ?? ctx.length,
  }
}

/** Whether a stream is active in year `index`. One-time items only fire in their start year. */
export function isActive(range: ResolvedRange, index: number, oneTime: boolean): boolean {
  if (oneTime) return index === range.start
  return index >= range.start && index < range.end
}

import type { CollegePreset, PlanChild, PlanDocument, PlanExpense, PlanMilestone, Timing } from "./plan-types"

/**
 * Cost of attendance per year (tuition, fees, room and board), today's dollars, rounded from the
 * College Board's 2024–25 averages.
 */
export const COLLEGE_PRESET_COSTS: Record<Exclude<CollegePreset, "custom">, number> = {
  public_in_state: 30_000,
  public_out_of_state: 49_000,
  private: 63_000,
}

export const COLLEGE_PRESET_LABELS: Record<CollegePreset, string> = {
  public_in_state: "Public, in-state",
  public_out_of_state: "Public, out-of-state",
  private: "Private",
  custom: "Custom",
}

/** Yearly cost of raising a child, today's dollars (USDA estimate, inflation-adjusted). */
export const DEFAULT_RAISING_COST = 18_000
export const DEFAULT_COLLEGE_GROWTH = 0.05
export const DEFAULT_529_CONTRIBUTION = 3_000
export const DEFAULT_529_RETURN = 0.06
export const DEFAULT_SUPPORT = 12_000
export const DEFAULT_SUPPORT_YEARS = 3

export function newChild(id: string, name: string, birthYear: number): PlanChild {
  return {
    id,
    name,
    birthYear,
    raising: { enabled: true, annualCost: DEFAULT_RAISING_COST, untilAge: 18 },
    college: {
      enabled: false,
      preset: "public_in_state",
      annualCost: COLLEGE_PRESET_COSTS.public_in_state,
      startAge: 18,
      years: 4,
      growth: DEFAULT_COLLEGE_GROWTH,
    },
    plan529: { enabled: false, accountId: null, annualContribution: DEFAULT_529_CONTRIBUTION },
    support: { enabled: false, annualAmount: DEFAULT_SUPPORT, years: DEFAULT_SUPPORT_YEARS },
  }
}

const atAge = (child: PlanChild, age: number): Timing => ({ type: "year", year: child.birthYear + age })

/** Age when support after college (or after raising costs, without college) begins. */
export function supportStartAge(child: PlanChild): number {
  return child.college.enabled ? child.college.startAge + child.college.years : child.raising.untilAge
}

/** Ids of a child's generated milestones and expenses, so other items can point at them. */
export const childIds = (childId: string) => ({
  born: `child-${childId}-born`,
  college: `child-${childId}-college`,
  graduates: `child-${childId}-graduates`,
  supportEnds: `child-${childId}-support-ends`,
  raising: `child-${childId}-raising`,
  collegeCost: `child-${childId}-college-cost`,
  supportCost: `child-${childId}-support`,
})

/** Milestones each child brings: born, starts college, graduates, support ends. */
export function childMilestones(doc: PlanDocument): PlanMilestone[] {
  return (doc.children ?? []).flatMap((child) => {
    const ids = childIds(child.id)
    const marks: PlanMilestone[] = [
      { id: ids.born, name: `${child.name} born`, kind: "child", icon: "child_care", timing: atAge(child, 0) },
    ]
    if (child.college.enabled) {
      marks.push(
        { id: ids.college, name: `${child.name} starts college`, kind: "child", icon: "school", timing: atAge(child, child.college.startAge) },
        {
          id: ids.graduates,
          name: `${child.name} graduates`,
          kind: "child",
          icon: "workspace_premium",
          timing: atAge(child, child.college.startAge + child.college.years),
        },
      )
    }
    if (child.support.enabled) {
      marks.push({
        id: ids.supportEnds,
        name: `${child.name}'s support ends`,
        kind: "child",
        icon: "family_restroom",
        timing: atAge(child, supportStartAge(child) + child.support.years),
      })
    }
    return marks
  })
}

function stream(id: string, name: string, amount: number, growth: number | null, start: Timing, end: Timing): PlanExpense {
  return { id, name, category: "Kids", amount, growth, start, end, oneTime: false, fundedBy: null }
}

/** Raising costs, college (paid from the 529 first) and support after college. */
export function childExpenses(doc: PlanDocument): PlanExpense[] {
  return (doc.children ?? []).flatMap((child) => {
    const ids = childIds(child.id)
    const out: PlanExpense[] = []
    if (child.raising.enabled) {
      out.push(stream(ids.raising, `${child.name}: raising`, child.raising.annualCost, null, atAge(child, 0), atAge(child, child.raising.untilAge)))
    }
    if (child.college.enabled) {
      const { startAge, years, annualCost, growth } = child.college
      out.push({
        ...stream(ids.collegeCost, `${child.name}: college`, annualCost, growth, atAge(child, startAge), atAge(child, startAge + years)),
        fundedBy: child.plan529.enabled ? child.plan529.accountId : null,
      })
    }
    if (child.support.enabled) {
      const start = supportStartAge(child)
      out.push(stream(ids.supportCost, `${child.name}: support`, child.support.annualAmount, null, atAge(child, start), atAge(child, start + child.support.years)))
    }
    return out
  })
}

/** A fixed yearly move of cash-flow money into an account (529 contributions). */
export interface PlanTransfer {
  id: string
  accountId: string
  /** Today's dollars per year; grows with inflation. */
  amount: number
  start: Timing
  end: Timing
}

/** 529 contributions: from now (or birth, if later) until college starts. */
export function childTransfers(doc: PlanDocument): PlanTransfer[] {
  const accountIds = new Set(doc.accounts.map((a) => a.id))
  return (doc.children ?? []).flatMap((child) => {
    const { enabled, accountId, annualContribution } = child.plan529
    if (!enabled || !accountId || !accountIds.has(accountId) || annualContribution <= 0) return []
    const born = Math.max(child.birthYear, doc.settings.startYear)
    const end = child.college.enabled ? child.birthYear + child.college.startAge : child.birthYear + 18
    return [{ id: `child-${child.id}-529`, accountId, amount: annualContribution, start: { type: "year", year: born }, end: { type: "year", year: end } }]
  })
}

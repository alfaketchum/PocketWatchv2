import { fireNumber, yearsToTarget } from "./fire-projection"

export interface CategoryMonth {
  month: string
  categories?: Record<string, number>
}

export interface CategoryCost {
  category: string
  monthly: number
  /** Extra nest egg this category requires at the plan's withdrawal rate. */
  nestEgg: number
  /** How much sooner you'd reach FI without it (spend drops, investing rises). Null if unknowable. */
  yearsSooner: number | null
}

interface CostPlan {
  investable: number
  annualSpend: number
  annualContribution: number
  swr: number
  realReturn: number
}

/** Average monthly spend per category over complete months (the current partial month is skipped). */
function averageByCategory(months: CategoryMonth[], currentMonth: string): Map<string, number> {
  const complete = months.filter((m) => m.month < currentMonth && m.categories)
  const totals = new Map<string, number>()
  for (const m of complete) {
    for (const [cat, amount] of Object.entries(m.categories ?? {})) {
      totals.set(cat, (totals.get(cat) ?? 0) + amount)
    }
  }
  const avg = new Map<string, number>()
  if (complete.length === 0) return avg
  for (const [cat, total] of totals) avg.set(cat, total / complete.length)
  return avg
}

/** The categories that cost the most years of work, largest first. */
export function categoryCosts(months: CategoryMonth[], currentMonth: string, plan: CostPlan, limit = 5): CategoryCost[] {
  const base = yearsToTarget(plan.investable, plan.annualContribution, plan.realReturn, fireNumber(plan.annualSpend, plan.swr))
  return [...averageByCategory(months, currentMonth)]
    .filter(([, monthly]) => monthly > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, monthly]) => {
      const annual = monthly * 12
      const without = yearsToTarget(
        plan.investable,
        plan.annualContribution + annual,
        plan.realReturn,
        fireNumber(Math.max(0, plan.annualSpend - annual), plan.swr),
      )
      return {
        category,
        monthly,
        nestEgg: fireNumber(annual, plan.swr),
        yearsSooner: base !== null && without !== null ? Math.max(0, base - without) : null,
      }
    })
}

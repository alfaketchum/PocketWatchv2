import { assetCostExpenses } from "./plan-asset-costs"
import { childExpenses } from "./plan-children"
import { planCreditPath } from "./credit-projection"
import { financingDebts } from "./plan-financing"
import { inflationOf, priceIndex, type Inflation } from "./plan-inflation"
import { allMilestones } from "./plan-milestones"
import { withReplacements } from "./plan-replacements"
import { rentalIncomes } from "./plan-rentals"
import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDebt, PlanDocument } from "./plan-types"

/**
 * The document the engine and charts work from: replacement cycles unrolled into successive assets,
 * generated child expenses, assets' running costs, rent from rented homes, loans from their "How you'll pay", and all
 * generated milestones (children, assets) folded in. Children and cycles are cleared, and generated
 * costs and loans are skipped when already present, so expanding twice is harmless. `inflation` overrides the
 * plan's own for sizing loans on future purchases (a stress test replaying history's inflation).
 */
export function expandPlan(doc: PlanDocument, inflation?: Inflation): PlanDocument {
  const withAssets = { ...doc, assets: withReplacements(doc) }
  const credit = planCreditPath(doc, inflation)
  return {
    ...withAssets,
    incomes: [...doc.incomes, ...rentalIncomes(withAssets)],
    expenses: [...doc.expenses, ...childExpenses(doc), ...assetCostExpenses(withAssets)],
    debts: [...doc.debts, ...financingDebts(withAssets, inflation, (i) => credit?.[i]?.pricing ?? null)],
    milestones: allMilestones(withAssets),
    children: [],
  }
}

/** A loan the plan creates on its own (a financed purchase or replacement), with the asset it pays for. */
export interface GeneratedDebt {
  debt: PlanDebt
  /** The asset in the editor it comes from (replacement cycles point back to the original). */
  assetId: string | null
  /** Calendar year the loan starts; its amounts are in that year's dollars. */
  year: number | null
  /** Divide its amounts by this for today's dollars (1 for a loan starting now). */
  deflator: number
}

/** Loans the plan adds from assets' "How you'll pay"; read-only, edited on the asset. */
export function generatedDebts(doc: PlanDocument): GeneratedDebt[] {
  const own = new Set(doc.debts.map((d) => d.id))
  const expanded = expandPlan(doc)
  const ctx = timingContext(expanded)
  const inflation = inflationOf(doc.settings)
  return expanded.debts
    .filter((d) => !own.has(d.id))
    .map((debt) => {
      const index = resolveTiming(debt.start, ctx)
      return {
        debt,
        assetId: debt.assetId ? debt.assetId.split("~")[0] : null,
        year: index === null ? null : doc.settings.startYear + index,
        deflator: priceIndex(inflation, Math.max(0, index ?? 0)),
      }
    })
}

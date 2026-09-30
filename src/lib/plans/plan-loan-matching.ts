import { TYPICAL_RUNNING_COSTS } from "./plan-asset-costs"
import { TYPICAL_FINANCING } from "./plan-financing"
import { resolveTiming, timingContext } from "./plan-timing"
import type { AssetKind, DebtKind, PlanAsset, PlanDebt, PlanDocument } from "./plan-types"

/** Loans that pay for an asset, and the kind of asset each one pays for. */
const ASSET_FOR_LOAN: Partial<Record<DebtKind, AssetKind>> = { mortgage: "home", auto: "vehicle" }
const TYPICAL_VALUE_CHANGE: Record<AssetKind, number> = { home: 0.03, vehicle: -0.15, other: 0 }
const ASSET_NAME: Record<AssetKind, string> = { home: "Home", vehicle: "Car", other: "Asset" }

export type LoanSuggestion =
  /** A real loan for something the plan meant to buy (or owns without a loan): link them. */
  | { type: "link"; debt: PlanDebt; asset: PlanAsset }
  /** A real loan with nothing in the plan it pays for: add the asset. */
  | { type: "addAsset"; debt: PlanDebt; kind: AssetKind; estimatedValue: number }

function refId(debt: PlanDebt): string | null {
  return debt.source?.kind === "finance-account" ? debt.source.refId : null
}

/**
 * The asset a real loan most likely pays for: a home or vehicle with no loan linked yet,
 * preferring the soonest planned purchase, then one owned already.
 */
function candidateFor(doc: PlanDocument, kind: AssetKind, taken: Set<string>): PlanAsset | null {
  const ctx = timingContext(doc)
  const linked = new Set(doc.debts.map((d) => d.assetId))
  const free = doc.assets.filter((a) => a.kind === kind && a.acquired !== "received" && !linked.has(a.id) && !taken.has(a.id))
  const when = (a: PlanAsset) => resolveTiming(a.start, ctx) ?? 0
  const planned = free.filter((a) => when(a) > 0).sort((a, b) => when(a) - when(b))
  return planned[0] ?? free[0] ?? null
}

/** Mortgages and auto loans in the user's linked accounts that the plan doesn't have (or ignore) yet. */
export function loanSuggestions(doc: PlanDocument, realLoans: PlanDebt[]): LoanSuggestion[] {
  const inPlan = new Set(doc.debts.map(refId).filter((id): id is string => id !== null))
  const ignored = new Set(doc.ignoredSources ?? [])
  const taken = new Set<string>()
  return realLoans.flatMap((debt): LoanSuggestion[] => {
    const id = refId(debt)
    const kind = ASSET_FOR_LOAN[debt.kind]
    if (!id || !kind || inPlan.has(id) || ignored.has(id)) return []
    const asset = candidateFor(doc, kind, taken)
    if (asset) {
      taken.add(asset.id)
      return [{ type: "link", debt, asset }]
    }
    const estimatedValue = Math.round(debt.balance / (1 - TYPICAL_FINANCING[kind].downShare))
    return [{ type: "addAsset", debt, kind, estimatedValue }]
  })
}

/** The real loan joins the plan today, paying for `assetId`, which is now owned (bought already). */
export function applyLoanLink(doc: PlanDocument, debt: PlanDebt, assetId: string): PlanDocument {
  return {
    ...doc,
    assets: doc.assets.map((a) => (a.id === assetId ? { ...a, start: { type: "planStart" } } : a)),
    debts: [...doc.debts, { ...debt, start: { type: "planStart" }, assetId }],
  }
}

/** Adds the asset a real loan pays for, owned today at `value`, with the loan linked to it. */
export function applyLoanAsAsset(doc: PlanDocument, debt: PlanDebt, kind: AssetKind, value: number, newId: (prefix: string) => string): PlanDocument {
  const asset: PlanAsset = {
    id: newId("asset"),
    name: ASSET_NAME[kind],
    kind,
    value,
    appreciation: TYPICAL_VALUE_CHANGE[kind],
    start: { type: "planStart" },
    end: { type: "planEnd" },
    runningCosts: TYPICAL_RUNNING_COSTS[kind],
  }
  return applyLoanLink({ ...doc, assets: [...doc.assets, asset] }, debt, asset.id)
}

/** Stop suggesting this linked loan for this plan. */
export function ignoreLoan(doc: PlanDocument, debt: PlanDebt): PlanDocument {
  const id = refId(debt)
  return id ? { ...doc, ignoredSources: [...new Set([...(doc.ignoredSources ?? []), id])] } : doc
}

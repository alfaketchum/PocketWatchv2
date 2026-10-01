import { runningCostsFor } from "./plan-asset-costs"
import { TYPICAL_FINANCING } from "./plan-financing"
import { resolveTiming, timingContext } from "./plan-timing"
import type { AssetKind, DebtKind, PlanAsset, PlanDebt, PlanDocument } from "./plan-types"

/** A home or vehicle the user entered on Finance › Homes & Vehicles, valued today. */
export interface KnownAsset {
  id: string
  kind: string
  name: string
  value: number
  appreciation: number
  loanAccountId: string | null
  propertyTaxAnnual?: number | null
}

const kindOf = (kind: string): AssetKind => (kind === "home" || kind === "vehicle" ? kind : "other")

/** Loans that pay for an asset, and the kind of asset each one pays for. */
const ASSET_FOR_LOAN: Partial<Record<DebtKind, AssetKind>> = { mortgage: "home", auto: "vehicle" }
const TYPICAL_VALUE_CHANGE: Record<AssetKind, number> = { home: 0.03, vehicle: -0.15, other: 0 }
const ASSET_NAME: Record<AssetKind, string> = { home: "Home", vehicle: "Car", other: "Asset" }

export type LoanSuggestion =
  /** A real loan for something the plan meant to buy (or owns without a loan): link them. */
  | { type: "link"; debt: PlanDebt; asset: PlanAsset }
  /** A real loan with nothing in the plan it pays for: add the asset (the one entered for it, if any). */
  | { type: "addAsset"; debt: PlanDebt; kind: AssetKind; estimatedValue: number; known?: KnownAsset }
  /** A home or vehicle entered on Homes & Vehicles, with no loan, that the plan doesn't have. */
  | { type: "addOwned"; asset: KnownAsset }

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

/** Homes and vehicles already in the plan from Homes & Vehicles (by their id there). */
function plannedKnown(doc: PlanDocument): Set<string> {
  return new Set(doc.assets.flatMap((a) => (a.source?.kind === "real-asset" ? [a.source.refId] : [])))
}

/**
 * Mortgages and auto loans in the user's linked accounts that the plan doesn't have (or ignore) yet, and
 * homes and vehicles entered on Homes & Vehicles without a loan that it doesn't have either.
 */
export function loanSuggestions(doc: PlanDocument, realLoans: PlanDebt[], known: KnownAsset[] = []): LoanSuggestion[] {
  const inPlan = new Set(doc.debts.map(refId).filter((id): id is string => id !== null))
  const ignored = new Set(doc.ignoredSources ?? [])
  const planned = plannedKnown(doc)
  const taken = new Set<string>()
  const loanSuggestionsFor = realLoans.flatMap((debt): LoanSuggestion[] => {
    const id = refId(debt)
    const kind = ASSET_FOR_LOAN[debt.kind]
    if (!id || !kind || inPlan.has(id) || ignored.has(id)) return []
    const entered = known.find((k) => k.loanAccountId === id && !planned.has(k.id))
    if (entered) return [{ type: "addAsset", debt, kind: kindOf(entered.kind), estimatedValue: Math.round(entered.value), known: entered }]
    const asset = candidateFor(doc, kind, taken)
    if (asset) {
      taken.add(asset.id)
      return [{ type: "link", debt, asset }]
    }
    const estimatedValue = Math.round(debt.balance / (1 - TYPICAL_FINANCING[kind].downShare))
    return [{ type: "addAsset", debt, kind, estimatedValue }]
  })
  const owned = known
    .filter((k) => !k.loanAccountId && !planned.has(k.id) && !ignored.has(k.id))
    .map((asset): LoanSuggestion => ({ type: "addOwned", asset }))
  return [...loanSuggestionsFor, ...owned]
}

/** A home or vehicle from Homes & Vehicles as a plan asset owned now, linked back for "Refresh balances". */
function assetFromKnown(k: KnownAsset, value: number, newId: (prefix: string) => string, state: string | null): PlanAsset {
  const kind = kindOf(k.kind)
  return {
    id: newId("asset"),
    name: k.name,
    kind,
    value,
    appreciation: k.appreciation,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    runningCosts: runningCostsFor(kind, state, { value: k.value, propertyTaxAnnual: k.propertyTaxAnnual }),
    source: { kind: "real-asset", refId: k.id },
  }
}

/** Adds a home or vehicle entered on Homes & Vehicles (no loan) to the plan, owned now. */
export function applyOwnedAsset(doc: PlanDocument, k: KnownAsset, newId: (prefix: string) => string): PlanDocument {
  return { ...doc, assets: [...doc.assets, assetFromKnown(k, Math.round(k.value), newId, doc.settings.state)] }
}

/** Stop suggesting this home or vehicle from Homes & Vehicles for this plan. */
export function ignoreKnownAsset(doc: PlanDocument, k: KnownAsset): PlanDocument {
  return { ...doc, ignoredSources: [...new Set([...(doc.ignoredSources ?? []), k.id])] }
}

/** The real loan joins the plan today, paying for `assetId`, which is now owned (bought already). */
export function applyLoanLink(doc: PlanDocument, debt: PlanDebt, assetId: string): PlanDocument {
  return {
    ...doc,
    assets: doc.assets.map((a) => (a.id === assetId ? { ...a, start: { type: "planStart" } } : a)),
    debts: [...doc.debts, { ...debt, start: { type: "planStart" }, assetId }],
  }
}

/** Adds the asset a real loan pays for (the one entered for it, if any), owned today at `value`, with the loan linked. */
export function applyLoanAsAsset(
  doc: PlanDocument,
  debt: PlanDebt,
  kind: AssetKind,
  value: number,
  newId: (prefix: string) => string,
  known?: KnownAsset,
): PlanDocument {
  const asset: PlanAsset = known ? assetFromKnown(known, value, newId, doc.settings.state) : {
    id: newId("asset"),
    name: ASSET_NAME[kind],
    kind,
    value,
    appreciation: TYPICAL_VALUE_CHANGE[kind],
    start: { type: "planStart" },
    end: { type: "planEnd" },
    runningCosts: runningCostsFor(kind, doc.settings.state),
  }
  return applyLoanLink({ ...doc, assets: [...doc.assets, asset] }, debt, asset.id)
}

/** Stop suggesting this linked loan for this plan. */
export function ignoreLoan(doc: PlanDocument, debt: PlanDebt): PlanDocument {
  const id = refId(debt)
  return id ? { ...doc, ignoredSources: [...new Set([...(doc.ignoredSources ?? []), id])] } : doc
}

import { inflationOf, type Inflation } from "./plan-inflation"
import { assetValue } from "./engine/engine-assets"
import { resolveTiming, timingContext } from "./plan-timing"
import type { AssetFinancing, AssetKind, DebtKind, PaymentMode, PlanAsset, PlanDebt, PlanDocument } from "./plan-types"

const MONTHS_PER_YEAR = 12

/** Typical terms when a purchase is financed but the loan isn't picked yet. */
export const TYPICAL_FINANCING: Record<AssetKind, Omit<AssetFinancing, "mode">> = {
  home: { downShare: 0.2, rate: 0.065, termYears: 30 },
  vehicle: { downShare: 0.1, rate: 0.075, termYears: 5 },
  other: { downShare: 0.2, rate: 0.08, termYears: 5 },
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  loan: "Loan",
  undecided: "Not decided yet",
}

const LOAN_KIND: Record<AssetKind, DebtKind> = { home: "mortgage", vehicle: "auto", other: "other" }
const LOAN_NAME: Record<AssetKind, string> = { home: "mortgage", vehicle: "loan", other: "loan" }

/** Level monthly payment that pays `loan` off over `months` at `annualRate`. */
export function monthlyPayment(loan: number, annualRate: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0
  const r = annualRate / MONTHS_PER_YEAR
  return r === 0 ? loan / months : (loan * r) / (1 - Math.pow(1 + r, -months))
}

/** The terms that apply: undecided uses the typical ones for the kind; null when paid in cash. */
export function effectiveFinancing(asset: PlanAsset): Omit<AssetFinancing, "mode"> | null {
  const f = asset.financing
  if (!f || f.mode === "cash") return null
  return f.mode === "undecided" ? TYPICAL_FINANCING[asset.kind] : f
}

export interface LoanSummary {
  down: number
  loan: number
  monthly: number
  totalInterest: number
}

/** Down payment, loan, payment and lifetime interest on a price (any dollar basis) at the given terms. */
export function loanSummary(price: number, terms: Omit<AssetFinancing, "mode">): LoanSummary {
  const down = price * terms.downShare
  const loan = price - down
  const months = terms.termYears * MONTHS_PER_YEAR
  const monthly = monthlyPayment(loan, terms.rate, months)
  return { down, loan, monthly, totalInterest: monthly * months - loan }
}

/** A future purchase: bought during the plan (not owned at the start, not inherited). */
export function isFuturePurchase(asset: PlanAsset, startIndex: number | null): boolean {
  return startIndex !== null && startIndex > 0 && asset.acquired !== "received"
}

/**
 * Loans generated from assets' "How you'll pay": one per financed future purchase, sized on the price
 * in the purchase year. A debt already linked to the asset (a real or hand-entered loan) always wins.
 */
export function financingDebts(doc: PlanDocument, inflation: Inflation = inflationOf(doc.settings)): PlanDebt[] {
  const ctx = timingContext(doc)
  const linked = new Set(doc.debts.map((d) => d.assetId).filter((id): id is string => id !== null))
  return doc.assets.flatMap((asset) => {
    const terms = effectiveFinancing(asset)
    const start = resolveTiming(asset.start, ctx)
    if (!terms || linked.has(asset.id) || !isFuturePurchase(asset, start)) return []
    const price = assetValue(asset, start ?? 0, start ?? 0, inflation, doc.settings.inflation)
    const { loan, monthly } = loanSummary(price, terms)
    if (loan <= 0) return []
    return [
      {
        id: `fin-${asset.id}`,
        name: `${asset.name} ${LOAN_NAME[asset.kind]}`,
        kind: LOAN_KIND[asset.kind],
        balance: loan,
        rate: terms.rate,
        monthlyPayment: monthly,
        start: asset.start,
        assetId: asset.id,
        source: null,
      },
    ]
  })
}

/** Short "paid with" label for a list: the linked debt, the payment choice, or how it was acquired. */
export function paidWithLabel(asset: PlanAsset, doc: PlanDocument): string {
  if (asset.acquired === "received") return "Inherited"
  const linked = doc.debts.find((d) => d.assetId === asset.id)
  if (linked) return linked.name
  if (asset.start.type === "planStart") return "Owned"
  return PAYMENT_MODE_LABELS[asset.financing?.mode ?? "cash"]
}

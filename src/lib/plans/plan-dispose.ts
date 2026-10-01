import { typicalRunningCosts } from "./plan-asset-costs"
import { TYPICAL_FINANCING } from "./plan-financing"
import type { PaymentMode, PlanAsset, PlanDocument, PlanExpense, PlanMilestone, Timing } from "./plan-types"

type IdMaker = (prefix: string) => string

export type DisposeMode = "sell" | "downsize"

export interface DownsizeChoice {
  /** Buy a smaller home, or rent instead. */
  to: "buy" | "rent"
  /** The new home's price, today's dollars. */
  price: number
  payWith: PaymentMode
  /** Rent per month, today's dollars. */
  monthlyRent: number
}

export interface DisposeChoice {
  mode: DisposeMode
  when: Timing
  downsize: DownsizeChoice
}

const at = (milestoneId: string): Timing => ({ type: "milestone", milestoneId })
const DOWNSIZE_ICON = "real_estate_agent"

function patchAsset(doc: PlanDocument, id: string, change: Partial<PlanAsset>): PlanDocument {
  return { ...doc, assets: doc.assets.map((a) => (a.id === id ? { ...a, ...change } : a)) }
}

/**
 * Sell an asset (its value comes back, less its loans and capital-gains tax), or downsize a home: sell it and buy a
 * smaller one or start renting. A downsize is one event: a milestone that the sale, the new home or the rent all hang
 * on, tagged with it so deleting it undoes them.
 */
export function applyDispose(doc: PlanDocument, assetId: string, choice: DisposeChoice, newId: IdMaker): PlanDocument {
  const asset = doc.assets.find((a) => a.id === assetId)
  if (!asset) return doc
  if (choice.mode === "sell") return patchAsset(doc, assetId, { end: choice.when })
  const msId = newId("ms-downsize")
  const milestone: PlanMilestone = { id: msId, name: `Downsize ${asset.name}`, kind: "custom", icon: DOWNSIZE_ICON, timing: choice.when }
  const sold = patchAsset({ ...doc, milestones: [...doc.milestones, milestone] }, assetId, { end: at(msId) })
  const d = choice.downsize
  if (d.to === "rent") {
    const rent: PlanExpense = {
      id: newId("exp"),
      name: "Rent",
      category: "Housing",
      amount: Math.round(d.monthlyRent * 12),
      growth: null,
      start: at(msId),
      end: { type: "planEnd" },
      oneTime: false,
      origin: msId,
    }
    return { ...sold, expenses: [...sold.expenses, rent] }
  }
  const home: PlanAsset = {
    id: newId("asset"),
    name: `Smaller home`,
    kind: "home",
    value: d.price,
    appreciation: asset.appreciation,
    start: at(msId),
    end: { type: "planEnd" },
    financing: { mode: d.payWith, ...TYPICAL_FINANCING.home },
    runningCosts: typicalRunningCosts("home", doc.settings.state),
    ...(asset.primaryResidence !== undefined ? { primaryResidence: asset.primaryResidence } : {}),
    origin: msId,
  }
  return { ...sold, assets: [...sold.assets, home] }
}

/** Keep an asset after all: no sale date. */
export function keepAsset(doc: PlanDocument, assetId: string): PlanDocument {
  return patchAsset(doc, assetId, { end: { type: "planEnd" } })
}

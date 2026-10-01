/**
 * Account returns are stored before inflation (nominal), which is what the engine uses. A plan can choose to
 * show and enter them after inflation (real) instead; the chosen basis is the one that stays fixed when the
 * plan's inflation changes.
 */

import { nominalRate, realRate } from "./plan-dollars"
import type { PlanDocument, PlanSettings } from "./plan-types"

export type ReturnBasis = "nominal" | "real"

const ROUND = 10_000
const round = (r: number) => Math.round(r * ROUND) / ROUND

export const returnBasisOf = (settings: Pick<PlanSettings, "returnBasis">): ReturnBasis => settings.returnBasis ?? "nominal"

/** The return as the plan shows it: as stored, or after the plan's inflation. */
export function shownReturn(stored: number, settings: Pick<PlanSettings, "returnBasis" | "inflation">): number {
  return returnBasisOf(settings) === "real" ? realRate(stored, settings.inflation) : stored
}

/** What to store for a return entered in the plan's basis. */
export function storedReturn(entered: number, settings: Pick<PlanSettings, "returnBasis" | "inflation">): number {
  return returnBasisOf(settings) === "real" ? round(nominalRate(entered, settings.inflation)) : entered
}

/** The same return in the other basis, for the hint under the field. */
export function otherReturn(stored: number, settings: Pick<PlanSettings, "returnBasis" | "inflation">): { value: number; label: string } {
  return returnBasisOf(settings) === "real"
    ? { value: stored, label: "before inflation" }
    : { value: realRate(stored, settings.inflation), label: "after inflation" }
}

/** Every account return re-based so its after-inflation value is the same at `inflation` as at the old rate. */
export function keepRealReturns(doc: PlanDocument, fromInflation: number, toInflation: number): PlanDocument {
  return { ...doc, accounts: doc.accounts.map((a) => ({ ...a, returnRate: round(nominalRate(realRate(a.returnRate, fromInflation), toInflation)) })) }
}

/**
 * Applies a settings change. When returns are entered after inflation and the inflation rate changes, the
 * stored returns move with it so the real returns you entered stay put.
 */
export function withSettings(doc: PlanDocument, change: Partial<PlanSettings>): PlanDocument {
  const next = { ...doc, settings: { ...doc.settings, ...change } }
  const moved = change.inflation !== undefined && change.inflation !== doc.settings.inflation
  return moved && returnBasisOf(next.settings) === "real" ? keepRealReturns(next, doc.settings.inflation, next.settings.inflation) : next
}

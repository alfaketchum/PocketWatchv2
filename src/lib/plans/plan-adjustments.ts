import { resolveTiming, type TimingContext } from "./plan-timing"
import type { PlanAdjustment, PlanSettings } from "./plan-types"

export interface AdjustmentEntry {
  adjustment: PlanAdjustment
  /** Year index it takes effect; null when its timing can't be placed. */
  index: number | null
}

export function adjustmentEntries(adjustments: PlanAdjustment[], ctx: TimingContext): AdjustmentEntry[] {
  return adjustments
    .map((adjustment) => ({ adjustment, index: resolveTiming(adjustment.timing, ctx) }))
    .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity))
}

/** Tax rates in effect in year `index`: the latest change at or before it, else the plan's rates. */
export function taxRatesAt(
  entries: AdjustmentEntry[],
  settings: PlanSettings,
  index: number,
): { incomeTaxRate: number; capitalGainsRate: number } {
  let rates = { incomeTaxRate: settings.incomeTaxRate, capitalGainsRate: settings.capitalGainsRate }
  for (const { adjustment, index: from } of entries) {
    if (adjustment.kind !== "taxRates" || from === null || from > index) continue
    rates = { incomeTaxRate: adjustment.incomeTaxRate, capitalGainsRate: adjustment.capitalGainsRate }
  }
  return rates
}

/** Filing status in effect in year `index`. */
export function filingStatusAt(entries: AdjustmentEntry[], settings: PlanSettings, index: number): "single" | "joint" {
  let status = settings.filingStatus
  for (const { adjustment, index: from } of entries) {
    if (adjustment.kind === "filingStatus" && from !== null && from <= index) status = adjustment.status
  }
  return status
}

/** State you live in during year `index` (null = no state income tax). */
export function stateAt(entries: AdjustmentEntry[], settings: PlanSettings, index: number): string | null {
  let state = settings.state
  for (const { adjustment, index: from } of entries) {
    if (adjustment.kind === "state" && from !== null && from <= index) state = adjustment.state
  }
  return state
}

/** Multiplier on your own expenses in year `index`: every spending change so far, compounded. */
export function spendingFactorAt(entries: AdjustmentEntry[], index: number): number {
  return entries.reduce(
    (factor, { adjustment, index: from }) =>
      adjustment.kind === "spending" && from !== null && from <= index ? factor * (1 + adjustment.percent) : factor,
    1,
  )
}

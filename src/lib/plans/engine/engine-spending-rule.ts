import { capeWithdrawalRate } from "@/lib/fire/cape-rule"
import { guardrailStep } from "@/lib/fire/withdrawal-strategies"
import type { PlanDocument, SpendingRule } from "../plan-types"
import type { Holdings } from "./engine-cashflow"

/** Where a spending rule stands after a year: its factor on planned flexible spending, and the starting rate. */
export interface RuleState {
  factor: number
  /** Guardrails: planned flexible spending ÷ portfolio in the first retired year; null until then. */
  initialRate: number | null
}

export const NO_RULE: RuleState = { factor: 1, initialRate: null }

/** What a rule reacts to: last year-end's portfolio of every account but 529s (they only pay for college). */
export function rulePortfolio(doc: PlanDocument, lastYearEnd: Holdings): number {
  return doc.accounts.filter((a) => a.taxTreatment !== "education").reduce((s, a) => s + Math.max(0, lastYearEnd.balances[a.id] ?? 0), 0)
}

const clamp = (v: number, floor: number | null, ceiling: number | null) => Math.min(ceiling ?? Infinity, Math.max(floor ?? 0, v))

/**
 * This year's factor on planned flexible spending. Before retirement (or without a rule, or with nothing flexible
 * planned) it's 1. Guardrails start at the plan and step it up or down; the portfolio rules spend a share of it
 * (bounded by floor / ceiling as shares of the plan). The CAPE rule waits for a valuation, spending as planned.
 */
export function ruleYear(
  rule: SpendingRule | undefined,
  input: { planned: number; portfolio: number; retired: boolean; cape: number | null },
  prev: RuleState,
): RuleState {
  const { planned, portfolio, retired, cape } = input
  if (!rule || !retired || planned <= 0) return { ...prev, factor: 1 }
  switch (rule.kind) {
    case "guardrails": {
      // The starting rate is set by the first retired year with a portfolio; until then, spend as planned.
      if (prev.initialRate === null) return { factor: 1, initialRate: portfolio > 0 ? planned / portfolio : null }
      const rate = portfolio > 0 ? (planned * prev.factor) / portfolio : Infinity
      return { ...prev, factor: prev.factor * guardrailStep(rate, prev.initialRate, rule.band, rule.step) }
    }
    case "percent":
      return { ...prev, factor: clamp((rule.rate * portfolio) / planned, rule.floor, rule.ceiling) }
    case "cape":
      if (cape === null) return { ...prev, factor: 1 }
      return { ...prev, factor: clamp((capeWithdrawalRate(cape, rule.a, rule.b) * portfolio) / planned, rule.floor, rule.ceiling) }
  }
}

/** One-sentence definitions for the plan chart's outcome terms, shown on hover in the legend and marker cards. */

export const PORTFOLIO_DEPLETED_DEFINITION =
  "Every savings and investment account (except 529s) is empty, so part of this year's spending goes unfunded; property is still owned and could be sold."

export const ASSETS_EXHAUSTED_DEFINITION =
  "After the portfolio is depleted, net worth has fallen below one year of spending, leaving little or nothing to sell."

export const UNFUNDED_SPENDING_DEFINITION =
  "Spending the portfolio couldn't cover once every account was depleted; it accrues as a debt that lowers net worth."

/** Definitions by chart milestone kind. */
export const MARK_DEFINITIONS: Partial<Record<string, string>> = {
  depleted: PORTFOLIO_DEPLETED_DEFINITION,
  broke: ASSETS_EXHAUSTED_DEFINITION,
}

/** Definitions by chart band key. */
export const BAND_DEFINITIONS: Partial<Record<string, string>> = {
  unfunded: UNFUNDED_SPENDING_DEFINITION,
}

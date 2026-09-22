/**
 * Helpers for relating a subscription to the transactions that formed it.
 */

export interface MerchantCharge {
  amount: number
  date: string
  name: string
}

/**
 * Narrow a merchant's transactions to the charges that actually formed this
 * subscription — those within ±10% of the recurring amount. Detection clusters
 * on amount, so a merchant with mixed charges shouldn't list every unrelated
 * purchase. Falls back to the raw recent list if nothing matches.
 */
export function chargesForSubscription(
  txns: MerchantCharge[],
  amount: number,
  limit = 6,
): MerchantCharge[] {
  if (amount <= 0) return txns.slice(0, limit)
  const band = Math.max(0.5, amount * 0.1)
  const matched = txns.filter((t) => Math.abs(Math.abs(t.amount) - amount) <= band)
  return (matched.length > 0 ? matched : txns).slice(0, limit)
}

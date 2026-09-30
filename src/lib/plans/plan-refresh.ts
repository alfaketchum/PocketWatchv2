import type { PlanDebt, PlanDocument, PlanSource } from "./plan-types"
import type { TradingActivity } from "./trading-detect"

/** Current balances of linked accounts (by finance account id), crypto, and homes and vehicles (by id). */
export interface SourceBalances {
  accounts: Record<string, number>
  crypto: number
  realAssets?: Record<string, number>
  /** Trading activity of linked brokerage accounts; suggestions only, never applied by a refresh. */
  trading?: Record<string, TradingActivity>
  /** Mortgages and auto loans in linked accounts; suggestions only, never applied by a refresh. */
  loans?: PlanDebt[]
}

function balanceFor(source: PlanSource | null, balances: SourceBalances): number | null {
  if (!source) return null
  if (source.kind === "crypto") return balances.crypto
  if (source.kind === "real-asset") return balances.realAssets?.[source.refId] ?? null
  return balances.accounts[source.refId] ?? null
}

/** New starting balances from linked accounts; the plan now starts this month. */
export function applySourceBalances(doc: PlanDocument, balances: SourceBalances, now: Date): PlanDocument {
  return {
    ...doc,
    settings: { ...doc.settings, startYear: now.getFullYear(), startMonth: now.getMonth() + 1 },
    accounts: doc.accounts.map((a) => {
      const balance = balanceFor(a.source, balances)
      return balance === null ? a : { ...a, balance }
    }),
    debts: doc.debts.map((d) => {
      const balance = balanceFor(d.source, balances)
      return balance === null ? d : { ...d, balance }
    }),
    assets: doc.assets.map((a) => {
      const value = balanceFor(a.source ?? null, balances)
      return value === null ? a : { ...a, value }
    }),
  }
}

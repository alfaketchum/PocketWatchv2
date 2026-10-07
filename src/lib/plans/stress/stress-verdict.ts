/**
 * The stress test's one-line verdict, net worth first: whether net worth lasts (never goes broke), then whether the cash
 * keeps paying the bills. A plan rich in property but short on cash says so, rather than reading as a failure.
 */

export type VerdictTone = "good" | "warn" | "bad"

const SAFE = 0.95
const SHAKY = 0.8

const pct = (v: number) => `${Math.round(v * 100)}%`

export function stressVerdict(cashRate: number, netWorthRate: number, markets = "markets"): { text: string; tone: VerdictTone } {
  if (netWorthRate >= SAFE) {
    if (cashRate >= SAFE) return { text: `Holds up in almost every ${markets.replace(/s$/, "")}`, tone: "good" }
    if (cashRate >= SHAKY) return { text: `Net worth holds; the cash runs short in the worst ${markets}`, tone: "warn" }
    return { text: `Wealthy on paper, short on cash: the accounts run dry in ${pct(1 - cashRate)} of ${markets}, with property left`, tone: "warn" }
  }
  if (netWorthRate >= SHAKY) return { text: `Goes broke in the worst ${markets} (${pct(1 - netWorthRate)})`, tone: "warn" }
  return { text: `Goes broke in ${pct(1 - netWorthRate)} of ${markets}`, tone: "bad" }
}

export const VERDICT_TONE_CLASS: Record<VerdictTone, string> = { good: "text-success", warn: "text-warning", bad: "text-error" }

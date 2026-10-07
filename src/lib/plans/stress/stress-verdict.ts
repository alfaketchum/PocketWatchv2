/**
 * The stress test's one-line verdict, net worth first: whether the plan stays solvent (assets never exhausted), then
 * whether the accounts fund every year. A plan rich in property but short on cash says so, rather than reading as a failure.
 */

export type VerdictTone = "good" | "warn" | "bad"

const SAFE = 0.95
const SHAKY = 0.8

const pct = (v: number) => `${Math.round(v * 100)}%`

export function stressVerdict(cashRate: number, netWorthRate: number, markets = "markets"): { text: string; tone: VerdictTone } {
  if (netWorthRate >= SAFE) {
    if (cashRate >= SAFE) return { text: `Fully funded in almost every ${markets.replace(/s$/, "")}`, tone: "good" }
    if (cashRate >= SHAKY) return { text: `Solvent throughout; accounts depleted in the worst ${markets}`, tone: "warn" }
    return { text: `Asset-rich, cash-constrained: accounts depleted in ${pct(1 - cashRate)} of ${markets}, with property remaining`, tone: "warn" }
  }
  if (netWorthRate >= SHAKY) return { text: `Assets exhausted in the worst ${markets} (${pct(1 - netWorthRate)})`, tone: "warn" }
  return { text: `Assets exhausted in ${pct(1 - netWorthRate)} of ${markets}`, tone: "bad" }
}

export const VERDICT_TONE_CLASS: Record<VerdictTone, string> = { good: "text-success", warn: "text-warning", bad: "text-error" }

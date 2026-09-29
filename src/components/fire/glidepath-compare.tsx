"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { failsafe, successRate, summarizeCohorts } from "@/lib/fire/swr-simulation"
import type { EquityPlan, MarketHistory, SimOptions } from "@/lib/fire/fire-types"
import { fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

const STRATEGIES: { label: string; equity: EquityPlan }[] = [
  { label: "60/40 static", equity: { start: 0.6, end: 0.6, glideMonths: 0 } },
  { label: "80/20 static", equity: { start: 0.8, end: 0.8, glideMonths: 0 } },
  { label: "100% stocks", equity: { start: 1, end: 1, glideMonths: 0 } },
  { label: "Glidepath 60→100% over 10 yrs", equity: { start: 0.6, end: 1, glideMonths: 120 } },
  { label: "Glidepath 60→100% over 15 yrs", equity: { start: 0.6, end: 1, glideMonths: 180 } },
]

/** Static allocations vs rising-equity glidepaths (ERN parts 19–20), at the user's horizon and target. */
export function GlidepathCompare({ history, opts, wr }: { history: MarketHistory; opts: SimOptions; wr: number }) {
  const rows = useMemo(() => {
    const base = { ...opts, flows: [] }
    return STRATEGIES.map((s) => {
      const o = { ...base, equity: s.equity }
      const worst = failsafe(summarizeCohorts(history, o))
      return { ...s, failsafe: worst, success: successRate(history, wr, o) }
    })
  }, [history, opts, wr])

  const best = Math.max(...rows.map((r) => r.failsafe?.wr ?? 0))

  return (
    <FireSectionCard
      eyebrow="Glidepaths"
      title="Start conservative, then shift into stocks"
      info="Big ERN found that starting around 60% stocks and gliding up to 100% over 10–15 years protects against an early crash (sequence risk) without giving up long-run growth."
    >
      <div className="overflow-x-auto rounded-lg border border-card-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-card-elevated text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="text-left font-semibold px-3 py-2">Strategy</th>
              <th className="text-right font-semibold px-3 py-2">Failsafe WR</th>
              <th className="text-right font-semibold px-3 py-2">Worst start</th>
              <th className="text-right font-semibold px-3 py-2">Success @ {fmtPct(wr, 2)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-card-border/50">
                <td className="px-3 py-2 text-foreground">{r.label}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", r.failsafe?.wr === best ? "text-success" : "text-foreground")}>
                  {fmtPct(r.failsafe?.wr, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{r.failsafe ? fmtMonth(r.failsafe.month) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmtPct(r.success, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-muted mt-3">
        {opts.horizonMonths / 12}-year horizon, {Math.round(opts.finalValue * 100)}% final value. Set your own glidepath in Advanced inputs on the Plan tab.
      </p>
    </FireSectionCard>
  )
}

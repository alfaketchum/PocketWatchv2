"use client"

import { useMemo } from "react"
import Link from "next/link"
import { failsafe, summarizeCohorts } from "@/lib/fire/swr-simulation"
import type { FireFlow, MarketHistory, SimOptions } from "@/lib/fire/fire-types"
import { fmtMoney, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

interface SupplementalFlowsCardProps {
  history: MarketHistory
  opts: SimOptions
  flows: FireFlow[]
  annualSpend: number
  retireAge: number
}

/** How future Social Security / pension income raises the personal safe withdrawal rate (ERN part 4+). */
export function SupplementalFlowsCard({ history, opts, flows, annualSpend, retireAge }: SupplementalFlowsCardProps) {
  const result = useMemo(() => {
    const without = failsafe(summarizeCohorts(history, { ...opts, flows: [] }))
    const withFlows = opts.flows.length ? failsafe(summarizeCohorts(history, opts)) : null
    return { without, withFlows }
  }, [history, opts])

  const base = result.without?.wr ?? null
  const personal = result.withFlows?.wr ?? null

  return (
    <FireSectionCard
      eyebrow="Retirement income"
      title="Social Security and pensions raise your safe withdrawal rate"
      info="Income that starts later lets you draw the portfolio down faster early on. Rates here are the failsafe (worst-case historical) withdrawal rate at your horizon, allocation and final-value target."
    >
      {flows.length === 0 || personal === null ? (
        <p className="text-sm text-foreground-muted">
          Add Social Security or a pension under <b className="text-foreground">Retirement income</b> in{" "}
          <Link href="/fire" className="text-primary hover:underline">Advanced inputs</Link> to see your personal safe rate.
          Without it, your failsafe rate is <b className="text-foreground">{fmtPct(base, 2)}</b>.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-foreground-muted">Portfolio only</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{fmtPct(base, 2)}</p>
              <p className="text-[11px] text-foreground-muted">needs {fmtMoney(base ? annualSpend / base : null)}</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-muted">With your income</p>
              <p className="text-2xl font-bold text-success tabular-nums">{fmtPct(personal, 2)}</p>
              <p className="text-[11px] text-foreground-muted">needs {fmtMoney(annualSpend / personal)}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-foreground-muted">
            {flows.map((f) => (
              <li key={f.id}>
                {f.label}: {fmtMoney(f.annualAmount)}/yr from age {f.startAge}
                {f.endAge !== null ? ` to ${f.endAge}` : ""} ({Math.max(0, Math.round(f.startAge - retireAge))} yrs after you retire)
              </li>
            ))}
          </ul>
        </>
      )}
    </FireSectionCard>
  )
}

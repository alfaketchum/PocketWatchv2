"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { EQUITY_STEPS, FINAL_VALUE_TARGETS, SWR_HORIZONS } from "@/lib/fire/fire-constants"
import { buildSwrGrid } from "@/lib/fire/swr-grid"
import type { MarketHistory } from "@/lib/fire/fire-types"
import { fmtPct, heatColor } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

type Metric = "failsafe" | "success"

/** Maps a failsafe WR onto 0..1 for coloring (2.5% → red, 4.5% → green). */
const WR_COLOR_MIN = 0.025
const WR_COLOR_MAX = 0.045

function Segmented<T extends string | number>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-card-border p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            o.value === value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** ERN's core table: failsafe WR (or success rate at your WR) by horizon × stock share. */
export function SwrHeatmap({ history, probeWr }: { history: MarketHistory; probeWr: number }) {
  const [finalValue, setFinalValue] = useState<number>(0)
  const [metric, setMetric] = useState<Metric>("failsafe")

  const grid = useMemo(() => buildSwrGrid(history, finalValue, probeWr), [history, finalValue, probeWr])
  const cell = (years: number, equity: number) =>
    grid.find((c) => c.horizonYears === years && Math.abs(c.equityShare - equity) < 1e-9)

  return (
    <FireSectionCard
      eyebrow="Safe withdrawal rate heatmap"
      title={metric === "failsafe" ? "Failsafe withdrawal rate — survived every historical cohort" : `Share of cohorts where ${fmtPct(probeWr, 2)} worked`}
      info="Each cell simulates every monthly retirement start since 1871 (real returns, 0.05% fees). Failsafe = the highest rate that never failed. Final value = how much of the starting (real) portfolio must remain at the end."
      right={
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={[{ value: "failsafe", label: "Failsafe WR" }, { value: "success", label: `Success @ ${fmtPct(probeWr, 2)}` }]}
          />
          <Segmented
            label="Final value target"
            value={finalValue}
            onChange={setFinalValue}
            options={FINAL_VALUE_TARGETS.map((v) => ({ value: v, label: `FV ${v * 100}%` }))}
          />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr className="text-foreground-muted">
              <th className="text-left font-medium px-2 py-1 whitespace-nowrap">Stocks →</th>
              {EQUITY_STEPS.map((e) => (
                <th key={e} className="font-medium px-1 py-1">{Math.round(e * 100)}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SWR_HORIZONS.map((years) => (
              <tr key={years}>
                <td className="px-2 py-1 text-foreground-muted whitespace-nowrap">{years} yrs</td>
                {EQUITY_STEPS.map((e) => {
                  const c = cell(years, e)
                  if (!c) return <td key={e} />
                  const t = metric === "failsafe"
                    ? (c.failsafeWr - WR_COLOR_MIN) / (WR_COLOR_MAX - WR_COLOR_MIN)
                    : (c.successAtProbe - 0.7) / 0.3
                  return (
                    <td
                      key={e}
                      title={`${years} yrs, ${Math.round(e * 100)}% stocks · failsafe ${fmtPct(c.failsafeWr, 2)} · ${fmtPct(c.successAtProbe, 1)} success at ${fmtPct(probeWr, 2)} · ${c.cohorts} cohorts`}
                      className="rounded-md text-center px-1 py-2 font-semibold text-white"
                      style={{ background: heatColor(t) }}
                    >
                      {metric === "failsafe" ? fmtPct(c.failsafeWr, 2) : fmtPct(c.successAtProbe, 0)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-muted mt-3">
        ERN&apos;s takeaways: longer horizons need lower rates (the 4% rule was built for 30 years), too few stocks hurts
        long retirements, and demanding capital preservation (FV 100%) costs roughly half a percentage point.
      </p>
    </FireSectionCard>
  )
}

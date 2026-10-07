"use client"

import type { CSSProperties } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { applyCandidate, type RothOptimization, type RothResult } from "@/lib/plans/roth/roth-optimizer"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { DocUpdater } from "../plans-helpers"
import { useRothOptimizer } from "./use-roth-optimizer"

const INFO =
  "Tries a couple of hundred strategies on your plan (fill each bracket, with and without the Medicare IRMAA cap, fixed amounts, converting everything by an age, over several windows), then fine-tunes the best few. Ranked by after-tax net worth at the end against converting nothing; strategies that make the money run out sooner are left out. Applying one replaces your conversion rules, which you can then edit. It uses your plan's own returns and inflation, so check the Stress test afterwards."

const SHOWN = 8

function signed(v: number): string {
  return `${v > 0 ? "+" : ""}${fmtMoney(v)}`
}

function ResultRow({ r, base, onApply, blur }: { r: RothResult; base: RothOptimization["baseline"]; onApply: () => void; blur?: CSSProperties }) {
  const taxes = r.outcome.lifetimeTaxes - base.lifetimeTaxes
  return (
    <tr className="border-t border-card-border align-top">
      <td className="py-1.5 pr-2 text-foreground">{r.candidate.label}</td>
      <td className={`whitespace-nowrap py-1.5 pl-3 text-right font-data ${r.gain >= 1 ? "text-success" : r.gain <= -1 ? "text-error" : "text-foreground-muted"}`} style={blur}>
        {signed(r.gain)}
      </td>
      <td className={`whitespace-nowrap py-1.5 pl-3 text-right font-data ${taxes <= -1 ? "text-success" : taxes >= 1 ? "text-error" : "text-foreground-muted"}`} style={blur}>
        {signed(taxes)}
      </td>
      <td className="whitespace-nowrap py-1.5 pl-3 text-right font-data text-foreground-muted" style={blur}>{fmtMoney(r.outcome.lifetimeConversions)}</td>
      <td className="py-1 pl-3 text-right">
        <button type="button" onClick={onApply} className="btn-secondary h-8 px-3 text-xs">
          Apply
        </button>
      </td>
    </tr>
  )
}

function Results({ result, doc, update, blur }: { result: RothOptimization; doc: PlanDocument; update: (u: DocUpdater, o?: { undoLabel?: string }) => void; blur?: CSSProperties }) {
  const best = result.top[0]
  const current = result.current ? result.current.afterTaxNetWorth - result.baseline.afterTaxNetWorth : null
  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted" style={blur}>
        {!best || best.gain < 1
          ? `Converting doesn't come out ahead on this plan: none of ${result.runs} strategies beat converting nothing.`
          : `Best of ${result.runs} strategies: ${signed(best.gain)} after tax at the end, against converting nothing.`}
        {current !== null && ` Your current rules: ${signed(current)}.`}
      </p>
      {result.top.length > 0 && (
        <div className="scroll-hint overflow-x-auto">
          <table className="w-full min-w-[40rem] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
                <th className="py-1.5 pr-2 font-semibold">Strategy</th>
                <th className="py-1.5 pl-3 text-right font-semibold">After-tax gain</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Lifetime taxes</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Converted</th>
                <th className="py-1.5 pl-3" />
              </tr>
            </thead>
            <tbody>
              {result.top.slice(0, SHOWN).map((r) => (
                <ResultRow
                  key={r.candidate.id}
                  r={r}
                  base={result.baseline}
                  blur={blur}
                  onApply={() => update((d) => applyCandidate(d, r.candidate), { undoLabel: r.candidate.label })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {doc.settings.taxMode !== "brackets" && <p className="text-xs text-warning">Your plan uses flat tax rates, so only fixed amounts and converting everything were tried. Switch to tax brackets (Assumptions → Taxes) to fill brackets.</p>}
    </div>
  )
}

/** Finds the conversion strategy that leaves the most after tax, on demand. */
export function RothOptimizerCard({ doc, update, isHidden }: { doc: PlanDocument; update: (u: DocUpdater, o?: { undoLabel?: string }) => void; isHidden: boolean }) {
  const opt = useRothOptimizer(doc)
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  const pct = opt.progress ? Math.round((opt.progress.done / Math.max(1, opt.progress.total)) * 100) : 0
  return (
    <FireSectionCard
      eyebrow="Optimizer"
      title="Find the conversions that leave the most after tax"
      info={INFO}
      right={
        opt.running ? (
          <button type="button" onClick={opt.stop} className="btn-secondary h-9 px-3 text-xs">Stop</button>
        ) : (
          <button type="button" onClick={opt.run} className="btn-primary h-9 px-3 text-xs">{opt.result ? "Run again" : "Find the best"}</button>
        )
      }
    >
      {opt.running && (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-background-secondary">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-foreground-muted font-data">{opt.progress ? `${opt.progress.done} / ${opt.progress.total}` : "Starting…"}</p>
        </div>
      )}
      {!opt.running && !opt.result && (
        <p className="text-xs text-foreground-muted">Runs your plan a couple of hundred times with different conversion strategies. Takes a few seconds.</p>
      )}
      {opt.result && (
        <div className="space-y-2">
          {opt.stale && <p className="text-[11px] text-foreground-muted">The plan has changed since this ran. Run again for fresh results.</p>}
          <Results result={opt.result} doc={doc} update={update} blur={blur} />
        </div>
      )}
    </FireSectionCard>
  )
}

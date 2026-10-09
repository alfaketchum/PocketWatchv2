"use client"

import { useMemo, type CSSProperties } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { rowInTodaysDollars } from "@/lib/plans/plan-dollars"
import { inflationOf } from "@/lib/plans/plan-inflation"
import { evaluate, type RothOutcome } from "@/lib/plans/roth/roth-optimizer"
import type { PlanDocument } from "@/lib/plans/plan-types"

const INFO =
  "Your plan as it is against the same plan with no conversions, in today's dollars. After-tax net worth takes the heirs' tax rate off whatever is left in traditional accounts at the end, since Roth money passes tax-free: it's the fair way to compare paying tax now with paying it later."

interface Metric {
  label: string
  value: (o: RothOutcome) => number
  better: "higher" | "lower" | null
  hint: string
}

const METRICS: Metric[] = [
  {
    label: "After-tax net worth at the end",
    value: (o) => o.afterTaxNetWorth,
    better: "higher",
    hint: "The score that matters: what's left at the end once your heirs' tax on traditional money is taken off. Higher means the conversions paid off.",
  },
  {
    label: "Net worth at the end",
    value: (o) => o.endingNetWorth,
    better: "higher",
    hint: "Before your heirs' tax. Often lower with conversions, since you paid tax early: that's expected, and why the line above is the fair comparison.",
  },
  {
    label: "Lifetime taxes",
    value: (o) => o.lifetimeTaxes,
    better: "lower",
    hint: "Every tax you pay over the plan. Conversions add tax in the years you convert and save it later, on smaller required withdrawals.",
  },
  {
    label: "Of which Medicare IRMAA",
    value: (o) => o.lifetimeIrmaa,
    better: "lower",
    hint: "Medicare surcharges from 65, based on income two years earlier. Converting can raise them for a while, then lower them by shrinking required withdrawals.",
  },
  {
    label: "Required withdrawals",
    value: (o) => o.lifetimeRequired,
    better: null,
    hint: "What the IRS makes you take from traditional accounts from 73 or 75. Converting first shrinks them, so less is forced out at higher rates.",
  },
  { label: "Converted", value: (o) => o.lifetimeConversions, better: null, hint: "The total moved from traditional to Roth over the plan." },
]

function Delta({ d, better, blur }: { d: number; better: Metric["better"]; blur?: CSSProperties }) {
  const good = better === null || Math.abs(d) < 1 ? null : (d > 0) === (better === "higher")
  const tone = good === null ? "text-foreground-muted" : good ? "text-success" : "text-error"
  return (
    <td className={`whitespace-nowrap py-1.5 pl-3 text-right font-data ${tone}`} style={blur}>
      {d > 0 ? "+" : ""}
      {fmtMoney(d)}
    </td>
  )
}

function YearTable({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const rows = useMemo(() => simulatePlan(doc).rows.map((r) => rowInTodaysDollars(r, inflationOf(doc.settings))).filter((r) => r.conversions >= 0.5), [doc])
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  if (rows.length === 0) return null
  const rothIds = doc.accounts.filter((a) => a.taxTreatment === "roth").map((a) => a.id)
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">Year by year</p>
        <p className="text-[11px] text-foreground-muted">
          Each year a rule converts: the amount, the extra tax it causes that year, your taxable income including it, and your Roth balance after.
        </p>
      </div>
      <div className="scroll-hint overflow-x-auto">
        <table className="w-full min-w-[32rem] text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="sticky left-0 bg-card py-1.5 pr-2 font-semibold">Year</th>
              <th className="py-1.5 pl-3 text-right font-semibold">Converted</th>
              <th className="py-1.5 pl-3 text-right font-semibold">Tax it adds</th>
              <th className="py-1.5 pl-3 text-right font-semibold">Taxable income</th>
              <th className="py-1.5 pl-3 text-right font-semibold">Roth at year end</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} className="border-t border-card-border">
                <td className="sticky left-0 bg-card whitespace-nowrap py-1.5 pr-2 text-foreground">
                  <span className="font-data">{r.year}</span> <span className="text-foreground-muted">· age {r.ages[0]}</span>
                </td>
                <td className="py-1.5 pl-3 text-right font-data text-foreground" style={blur}>{fmtMoney(r.conversions)}</td>
                <td className="py-1.5 pl-3 text-right font-data text-foreground-muted" style={blur}>{fmtMoney(r.conversionTax)}</td>
                <td className="py-1.5 pl-3 text-right font-data text-foreground-muted" style={blur}>{fmtMoney(r.taxableIncome)}</td>
                <td className="py-1.5 pl-3 text-right font-data text-foreground" style={blur}>{fmtMoney(rothIds.reduce((s, id) => s + (r.balances[id] ?? 0), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** One plain sentence: what the conversions cost now and what they leave at the end. */
function verdict(none: RothOutcome, plan: RothOutcome): string {
  const gain = plan.afterTaxNetWorth - none.afterTaxNetWorth
  const taxes = plan.lifetimeTaxes - none.lifetimeTaxes
  const taxPart = taxes >= 1 ? `pay ${fmtMoney(taxes)} more tax over your life` : taxes <= -1 ? `pay ${fmtMoney(-taxes)} less tax over your life` : "pay about the same tax"
  const start = `You convert ${fmtMoney(plan.lifetimeConversions)} in all, ${taxPart},`
  if (gain >= 1) return `${start} and leave ${fmtMoney(gain)} more after tax at the end. These conversions pay off.`
  if (gain <= -1) return `${start} and leave ${fmtMoney(-gain)} less after tax at the end. On this plan they cost more than they save: try the optimizer.`
  return `${start} and come out about even after tax.`
}

/** What the plan's conversion rules do, against converting nothing, and each year they convert. */
export function RothImpact({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const outcomes = useMemo(() => ({ none: evaluate({ ...doc, conversions: [] }), plan: evaluate(doc) }), [doc])
  const blur = isHidden ? { filter: "blur(6px)" } : undefined
  if ((doc.conversions ?? []).length === 0) return null
  return (
    <FireSectionCard eyebrow="Impact" title="Your conversions against none, today's dollars" info={INFO}>
      <div className="space-y-5">
        <p className="text-sm text-foreground" style={blur}>{verdict(outcomes.none, outcomes.plan)}</p>
        <div className="scroll-hint overflow-x-auto">
          <table className="w-full min-w-[30rem] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-foreground-muted">
                <th className="sticky left-0 bg-card py-1.5 pr-2 font-semibold" />
                <th className="py-1.5 pl-3 text-right font-semibold">No conversions</th>
                <th className="py-1.5 pl-3 text-right font-semibold">With yours</th>
                <th className="py-1.5 pl-3 text-right font-semibold">Difference</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.label} className="border-t border-card-border">
                  <td className="sticky left-0 bg-card py-1.5 pr-2 text-foreground">
                    <span className="inline-flex items-center gap-1">
                      {m.label}
                      <InfoTooltip content={m.hint}>
                        <span className="material-symbols-rounded text-foreground-muted cursor-help" style={{ fontSize: 13 }}>
                          info
                        </span>
                      </InfoTooltip>
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pl-3 text-right font-data text-foreground-muted" style={blur}>{fmtMoney(m.value(outcomes.none))}</td>
                  <td className="whitespace-nowrap py-1.5 pl-3 text-right font-data text-foreground" style={blur}>{fmtMoney(m.value(outcomes.plan))}</td>
                  <Delta d={m.value(outcomes.plan) - m.value(outcomes.none)} better={m.better} blur={blur} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {outcomes.plan.depletedAge !== null && (outcomes.none.depletedAge === null || outcomes.plan.depletedAge < outcomes.none.depletedAge) && (
          <p className="text-xs text-error">With these conversions the accounts run dry at {outcomes.plan.depletedAge}, sooner than without them.</p>
        )}
        <YearTable doc={doc} isHidden={isHidden} />
      </div>
    </FireSectionCard>
  )
}

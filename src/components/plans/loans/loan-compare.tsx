"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { usePlanColors } from "@/components/plans/results/use-plan-colors"
import { assumedReturn, breakEvenReturn, compareLoanOptions, type LoanOutcome } from "@/lib/plans/plan-loan-compare"
import { loanOptions, withLoanOption, type LoanChoice, type LoanOption, type LoanTerm } from "@/lib/plans/plan-loan-options"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { DocUpdater } from "../plans-helpers"
import { LoanDifferenceChart } from "./loan-difference-chart"
import { LoanNotes } from "./loan-notes"
import { LoanOptionsTable } from "./loan-options-table"
import { LoanStressTable } from "./loan-stress-table"
import { useLoanStress } from "./use-loan-stress"

/** Each option reruns the whole plan (and the breakeven a few dozen times), so wait for edits to settle. */
const COMPARE_DELAY_MS = 300
/** Lines on the chart besides the plan itself. */
const MAX_LINES = 4

const pct = (v: number) => `${(v * 100).toFixed(2)}%`

interface Props {
  doc: PlanDocument
  update: (u: DocUpdater) => void
  choice: LoanChoice
  extra: number
  onExtra: (extra: number) => void
  rates: Record<LoanTerm, number>
  onRates: (rates: Record<LoanTerm, number>) => void
  isHidden: boolean
}

/** Which outcomes get a line: the custom extra, then other terms, then payoff targets (the plan itself is the zero line). */
const LINE_ORDER: LoanOption["key"][] = ["extra", "term", "payoff"]
function lineIndexes(outcomes: LoanOutcome[]): number[] {
  return LINE_ORDER.flatMap((key) => outcomes.flatMap((o, i) => (o.option.key === key ? [i] : []))).slice(0, MAX_LINES)
}

/** The option the breakeven is measured on: the custom extra, or else the first payoff target. */
function prepayOption(options: LoanOption[]): LoanOption | null {
  return options.find((o) => o.key === "extra" && o.extraMonthly > 0) ?? options.find((o) => o.key === "payoff") ?? null
}

function BreakEven({ choice, breakEven, assumed }: { choice: LoanChoice; breakEven: number | null; assumed: number | null }) {
  return (
    <p className="text-sm leading-relaxed text-foreground">
      Paying extra toward this loan earns a guaranteed <span className="font-semibold">{pct(choice.rate)}</span>, the rate it stops charging.{" "}
      {breakEven === null ? (
        <>One side wins at any return from −20% to +20% a year, so the choice doesn&apos;t hinge on markets.</>
      ) : (
        <>
          Investing the money instead comes out ahead only if your investments earn more than{" "}
          <span className="font-semibold">{pct(breakEven)}</span> a year
          {assumed !== null && <> (your plan assumes {pct(assumed)})</>}, after the taxes and deductions in your plan. Both rates are before inflation.
        </>
      )}
    </p>
  )
}

/** Options for one loan, run through the whole plan: the table, the gap over time, the breakeven and history. */
export function LoanCompare({ doc, update, choice, extra, onExtra, rates, onRates, isHidden }: Props) {
  const colors = usePlanColors().series
  const options = useMemo(() => loanOptions(choice, extra, rates), [choice, extra, rates])
  const [outcomes, setOutcomes] = useState<LoanOutcome[] | null>(null)
  const [breakEven, setBreakEven] = useState<number | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOutcomes(compareLoanOptions(doc, choice, options))
      const prepay = prepayOption(options)
      setBreakEven(prepay ? breakEvenReturn(doc, choice, prepay) : null)
    }, COMPARE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [doc, choice, options])
  const docs = useMemo(() => outcomes?.map((o) => o.doc) ?? [], [outcomes])
  const stress = useLoanStress(docs)

  if (!outcomes) return <div className="h-[420px] animate-shimmer rounded-2xl" />
  const lineIdx = lineIndexes(outcomes)
  const lines = lineIdx.map((i) => outcomes[i])
  const prepay = prepayOption(options)
  const use = (option: LoanOption) => {
    update((d) => withLoanOption(d, choice, option))
    toast.success(`Saved to ${choice.name}`)
  }
  return (
    <div className="space-y-5">
      <FireSectionCard eyebrow="Your options" title={`${choice.name}: what each choice does to your plan`}>
        <div className="space-y-4">
          <LoanOptionsTable
            outcomes={outcomes}
            colors={outcomes.map((_, i) => (lineIdx.includes(i) ? colors[lineIdx.indexOf(i)] : null))}
            loanYear={choice.startIndex > 0 ? choice.startYear : null}
            extra={extra}
            onExtra={onExtra}
            rates={rates}
            onRate={(term, rate) => onRates({ ...rates, [term]: rate })}
            onUse={use}
            isHidden={isHidden}
          />
          <p className="text-[11px] text-foreground-muted">
            Net worth in today&apos;s dollars, home included and loans subtracted. Interest and taxes are totals over the plan.
          </p>
        </div>
      </FireSectionCard>
      {prepay && (
        <FireSectionCard eyebrow="Pay down or invest?" title="The return investing has to beat">
          <BreakEven choice={choice} breakEven={breakEven} assumed={assumedReturn(doc)} />
        </FireSectionCard>
      )}
      {lines.length > 0 && (
        <FireSectionCard eyebrow="Over time" title="Net worth compared with the plan as it is, today's dollars">
          <LoanDifferenceChart planned={outcomes[0]} shown={lines} colors={colors} isHidden={isHidden} />
        </FireSectionCard>
      )}
      <FireSectionCard eyebrow="History" title="In good markets and bad">
        {stress.error ? (
          <p className="text-xs text-foreground-muted">Market history couldn&apos;t be loaded, so this part is unavailable right now.</p>
        ) : (
          <LoanStressTable outcomes={outcomes} stress={stress.result} running={stress.running} isHidden={isHidden} />
        )}
      </FireSectionCard>
      <FireSectionCard eyebrow="Why" title="What's behind the numbers">
        <LoanNotes />
      </FireSectionCard>
    </div>
  )
}

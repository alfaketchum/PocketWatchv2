"use client"

import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { cn } from "@/lib/utils"
import type { LoanOutcome } from "@/lib/plans/plan-loan-compare"
import { optionLabel, type LoanOption, type LoanTerm } from "@/lib/plans/plan-loan-options"

interface Props {
  outcomes: LoanOutcome[]
  /** Swatch per option, in order (null: not on the chart). */
  colors: (string | null)[]
  /** Calendar year the loan's dollars are in, when that isn't today. */
  loanYear: number | null
  extra: number
  onExtra: (extra: number) => void
  rates: Record<LoanTerm, number>
  onRate: (term: LoanTerm, rate: number) => void
  onUse: (option: LoanOption) => void
  isHidden: boolean
}

/** An amount and, below it, how far it is from the plan as it is. */
function WithGap({ value, planned, isPlanned }: { value: number; planned: number; isPlanned: boolean }) {
  const gap = value - planned
  return (
    <>
      {fmtCompact(value)}
      {!isPlanned && Math.abs(gap) >= 1 && (
        <span className={cn("block text-[10px]", gap > 0 ? "text-success" : "text-foreground-muted")}>
          {gap > 0 ? "+" : "−"}
          {fmtCompact(Math.abs(gap))}
        </span>
      )}
    </>
  )
}

/** Highest ending net worth among options whose money lasts. */
function bestIndex(outcomes: LoanOutcome[]): number {
  const score = (o: LoanOutcome) => (o.runsOutAge === null ? o.netWorthEnd : -Infinity)
  return outcomes.reduce((best, o, i) => (score(o) > score(outcomes[best]) ? i : best), 0)
}

function OptionCell({ outcome, extra, onExtra, rates, onRate, loanYear }: Pick<Props, "extra" | "onExtra" | "rates" | "onRate" | "loanYear"> & { outcome: LoanOutcome }) {
  const o = outcome.option
  if (o.key === "extra") {
    return (
      <div className="w-36">
        <FireNumberField label={`Extra / month${loanYear ? ` (${loanYear} $)` : ""}`} prefix="$" min={0} value={extra} onChange={(v) => onExtra(Math.max(0, Math.round(v)))} />
      </div>
    )
  }
  if (o.key === "term") {
    return (
      <div className="w-28">
        <FireNumberField label="Rate" suffix="%" scale={100} min={0} max={1} value={rates[o.years]} onChange={(v) => onRate(o.years, v)} />
      </div>
    )
  }
  if (o.key === "payoff") return <span className="text-[11px] text-foreground-muted">+{fmtMoney(o.extraMonthly)}/mo</span>
  return null
}

/** Each option's payment, payoff and what it does to the plan, best ending net worth marked. */
export function LoanOptionsTable({ outcomes, colors, loanYear, extra, onExtra, rates, onRate, onUse, isHidden }: Props) {
  const best = bestIndex(outcomes)
  const head = "px-3 py-2 font-semibold text-right whitespace-nowrap"
  const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap"
  return (
    <div className="overflow-x-auto -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
            <th className="px-3 py-2 font-semibold text-left">Option</th>
            <th className="px-3 py-2" />
            <th className={head}>Monthly{loanYear ? ` (${loanYear} $)` : ""}</th>
            <th className={head}>Paid off</th>
            <th className={head}>Interest</th>
            <th className={head}>At retirement</th>
            <th className={head}>At the end</th>
            <th className={head}>Taxes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {outcomes.map((o, i) => (
            <tr key={i} className={cn("border-t border-card-border align-middle", i === best && "bg-success/5")}>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  {colors[i] && <span className="h-2 w-2 rounded-sm" style={{ background: colors[i]! }} />}
                  {optionLabel(o.option)}
                </span>
                {i === best && <span className="ml-1.5 text-[10px] font-medium text-success">Most at the end</span>}
              </td>
              <td className="px-3 py-1">
                <OptionCell outcome={o} extra={extra} onExtra={onExtra} rates={rates} onRate={onRate} loanYear={loanYear} />
              </td>
              <td className={num}>{fmtMoney(o.payment)}</td>
              <td className={num}>{o.payoffYear ?? "—"}</td>
              <td className={num}>{fmtCompact(o.interest)}</td>
              <td className={num}>
                {o.netWorthAtRetirement === null ? "—" : <WithGap value={o.netWorthAtRetirement} planned={outcomes[0].netWorthAtRetirement ?? 0} isPlanned={i === 0} />}
              </td>
              <td className={num}>
                {o.runsOutAge !== null ? (
                  <span className="text-error font-medium">Out at {o.runsOutAge}</span>
                ) : (
                  <WithGap value={o.netWorthEnd} planned={outcomes[0].netWorthEnd} isPlanned={i === 0} />
                )}
              </td>
              <td className={num}>{fmtCompact(o.lifetimeTax)}</td>
              <td className="px-3 py-2 text-right">
                {o.option.key !== "planned" && (
                  <button type="button" onClick={() => onUse(o.option)} className="btn-ghost h-7 px-2 text-xs text-primary whitespace-nowrap">
                    Use this
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

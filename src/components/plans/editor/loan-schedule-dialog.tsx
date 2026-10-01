"use client"

import { useMemo, useState } from "react"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { DollarsToggle } from "@/components/plans/results/dollars-toggle"
import { usePlanColors } from "@/components/plans/results/use-plan-colors"
import { loanSchedule, scheduleInBasis, type LoanSchedule } from "@/lib/plans/plan-amortization"
import { helocTerms } from "@/lib/plans/plan-debt-payments"
import { expandPlan } from "@/lib/plans/plan-expand"
import { inflationOf, priceIndex } from "@/lib/plans/plan-inflation"
import type { DollarBasis, PlanDocument } from "@/lib/plans/plan-types"
import { primaryAge } from "../plans-helpers"
import { LoanScheduleTable } from "./loan-schedule-table"

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-card-border px-3 py-2">
      <div className="text-[11px] text-foreground-muted">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
      {detail && <div className="text-[11px] text-foreground-muted">{detail}</div>}
    </div>
  )
}

function payoffStat(s: LoanSchedule): { value: string; detail: string } {
  if (s.neverPaysOff) return { value: "Never", detail: "The payment doesn't cover the interest" }
  if (s.paidFromSale) return { value: String(s.paidFromSale.year), detail: `${fmtMoney(s.paidFromSale.amount)} paid from the sale` }
  if (s.payoffYear !== null) return { value: String(s.payoffYear), detail: `${s.years.reduce((n, y) => n + y.months.length, 0)} payments` }
  return { value: "—", detail: "" }
}

function Stats({ schedule, borrowed }: { schedule: LoanSchedule; borrowed: number }) {
  const first = schedule.years[0]?.months[0]?.payment ?? 0
  const last = schedule.years[schedule.years.length - 1]?.months.at(-1)?.payment ?? 0
  const repayFrom = schedule.drawEndsYear !== null ? schedule.years.find((y) => y.year === schedule.drawEndsYear! + 1) : undefined
  const paymentDetail = repayFrom
    ? `${fmtMoney(repayFrom.months[0].payment)} from ${repayFrom.year}, repaying`
    : Math.abs(last - first) >= 1
      ? `${fmtMoney(last)} by the last one`
      : "The same every month"
  const payoff = payoffStat(schedule)
  const share = borrowed > 0 ? Math.round((schedule.totalInterest / borrowed) * 100) : 0
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Monthly payment" value={fmtMoney(first)} detail={paymentDetail} />
      <Stat label="Total interest" value={fmtMoney(schedule.totalInterest)} detail={`${share}% of what was borrowed`} />
      <Stat
        label="Principal passes interest"
        value={schedule.crossover ? String(schedule.crossover.year) : "—"}
        detail={schedule.crossover ? (schedule.crossover.n === 1 ? "From the first payment" : `At payment ${schedule.crossover.n}`) : "Not before it's paid"}
      />
      <Stat label="Paid off" value={payoff.value} detail={payoff.detail} />
    </div>
  )
}

/** The first payment after a HELOC's draw period ends, and the one before it. */
function repayJump(schedule: LoanSchedule): { year: number; before: number; after: number } | null {
  const at = schedule.drawEndsYear === null ? -1 : schedule.years.findIndex((y) => y.year === schedule.drawEndsYear! + 1)
  if (at <= 0) return null
  return { year: schedule.years[at].year, before: schedule.years[at - 1].months[0].payment, after: schedule.years[at].months[0].payment }
}

/** `nominal` is the schedule in future dollars: the payment jump is quoted as the statement shows it. */
function Notes({ schedule, nominal, basis }: { schedule: LoanSchedule; nominal: LoanSchedule; basis: DollarBasis }) {
  const terms = helocTerms(schedule.debt)
  const jump = repayJump(nominal)
  return (
    <div className="space-y-1.5 text-[11px] leading-relaxed text-foreground-muted">
      <p>
        <span className="font-medium text-foreground">Why so much interest at first?</span> Each month&apos;s interest is the rate times what you
        still owe. Early on you owe the most, so most of the payment is interest; each payment shrinks the balance, so a little more goes to
        principal the next month.
      </p>
      <p>
        <span className="font-medium text-foreground">{basis === "today" ? "Today's dollars." : "Future dollars."}</span>{" "}
        {basis === "today"
          ? "The payment shrinks every year here: inflation makes each dollar you repay worth less. In future dollars it stays flat, as your statement will show."
          : "These are the amounts your statements will show. Switch to today's dollars to see inflation shrink the fixed payment."}
      </p>
      {terms && jump && (
        <p>
          <span className="font-medium text-foreground">The draw period.</span> Through {schedule.drawEndsYear} you pay only interest, so the balance
          doesn&apos;t fall{basis === "today" && " (here it shrinks only through inflation)"}. In {jump.year} the payment goes from{" "}
          {fmtMoney(jump.before)} to {fmtMoney(jump.after)} a month on your statement, to repay it over {terms.repayYears} years.
        </p>
      )}
      {schedule.years.some((y) => y.afterPlan) && <p>Greyed years fall after your plan ends.</p>}
    </div>
  )
}

/** A loan's payment schedule: the split between interest and principal, year by year and month by month. */
export function LoanScheduleDialog({ doc, debtId, onClose }: { doc: PlanDocument; debtId: string; onClose: () => void }) {
  const [basis, setBasis] = useState<DollarBasis>("today")
  const colors = usePlanColors().loan
  const inflation = useMemo(() => inflationOf(doc.settings), [doc.settings])
  const schedule = useMemo(() => loanSchedule(expandPlan(doc, inflation), debtId), [doc, inflation, debtId])
  const shown = useMemo(() => schedule && scheduleInBasis(schedule, basis, inflation), [schedule, basis, inflation])
  // What was borrowed, in the same dollars as the interest it's compared with.
  const borrowed = schedule?.years[0] ? schedule.debt.balance / (basis === "today" ? priceIndex(inflation, schedule.years[0].index) : 1) : 0
  return (
    <AccountsModalShell
      wide
      title={schedule ? `${schedule.debt.name}: payment schedule` : "Payment schedule"}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="btn-secondary text-sm">
          Close
        </button>
      }
    >
      {!shown || shown.years.length === 0 ? (
        <p className="text-sm text-foreground-muted">Nothing is owed on this loan.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-foreground-muted">
              {fmtMoney(schedule!.debt.balance)} at {(schedule!.debt.rate * 100).toFixed(2)}% from {shown.years[0].year}
            </p>
            <DollarsToggle value={basis} onChange={setBasis} />
          </div>
          <Stats schedule={shown} borrowed={borrowed} />
          <LoanScheduleTable schedule={shown} age0={primaryAge(doc)} colors={colors} />
          <Notes schedule={shown} nominal={schedule!} basis={basis} />
        </>
      )}
    </AccountsModalShell>
  )
}

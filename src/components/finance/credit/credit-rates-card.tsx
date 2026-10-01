"use client"

import Link from "next/link"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { monthlyPayment } from "@/lib/plans/plan-debt-payments"
import { AUTO_TIERS, autoTierAt, MORTGAGE_MIN_SCORE, MORTGAGE_SCORE_STEPS, mortgageRateAt } from "@/lib/plans/credit-rates"

/** The loan the monthly difference is shown on. */
const EXAMPLE_LOAN = 400_000
const EXAMPLE_MONTHS = 360

const pct = (v: number) => `${(v * 100).toFixed(2)}%`

function Row({ label, now, better, betterLabel }: { label: string; now: string; better: string | null; betterLabel: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-foreground-muted">{label}</span>
      <span className="text-right tabular-nums">
        <span className="font-semibold text-foreground">{now}</span>
        {better && <span className="block text-[11px] text-foreground-muted">{better} at {betterLabel}</span>}
      </span>
    </div>
  )
}

/** Typical rates at this score, and what the next step up would save. */
export function CreditRatesCard({ score }: { score: number }) {
  const rate = mortgageRateAt(score)
  const stepIndex = MORTGAGE_SCORE_STEPS.findIndex((s) => score >= s.min)
  const next = stepIndex > 0 ? MORTGAGE_SCORE_STEPS[stepIndex - 1] : stepIndex === -1 ? MORTGAGE_SCORE_STEPS[MORTGAGE_SCORE_STEPS.length - 1] : null
  const payment = monthlyPayment(EXAMPLE_LOAN, rate, EXAMPLE_MONTHS)
  const saving = next ? payment - monthlyPayment(EXAMPLE_LOAN, next.rate, EXAMPLE_MONTHS) : 0
  const tier = autoTierAt(score)
  const tierIndex = AUTO_TIERS.indexOf(tier)
  const nextTier = tierIndex > 0 ? AUTO_TIERS[tierIndex - 1] : null
  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">What it costs to borrow</p>
        <p className="text-sm font-semibold text-foreground mt-1">Typical rates at {score}</p>
      </div>
      <div className="space-y-2.5">
        <Row label="30-year mortgage" now={pct(rate)} better={next ? pct(next.rate) : null} betterLabel={next ? `${next.min}+` : null} />
        <Row label={`New car (${tier.label.toLowerCase()})`} now={pct(tier.newRate)} better={nextTier ? pct(nextTier.newRate) : null} betterLabel={nextTier ? `${nextTier.min}+` : null} />
        <Row label="Used car" now={pct(tier.usedRate)} better={nextTier ? pct(nextTier.usedRate) : null} betterLabel={nextTier ? `${nextTier.min}+` : null} />
      </div>
      <p className="text-xs leading-relaxed text-foreground-muted">
        {score < MORTGAGE_MIN_SCORE
          ? `Most conventional lenders want at least ${MORTGAGE_MIN_SCORE} for a mortgage.`
          : next
            ? <>On a {fmtMoney(EXAMPLE_LOAN)} 30-year mortgage that&apos;s {fmtMoney(payment)} a month; reaching {next.min} would save about {fmtMoney(saving)} a month ({fmtMoney(saving * EXAMPLE_MONTHS)} over the loan).</>
            : <>You&apos;re in the best mortgage pricing tier: {fmtMoney(payment)} a month on a {fmtMoney(EXAMPLE_LOAN)} 30-year loan.</>}
      </p>
      <p className="text-[11px] text-foreground-muted">
        Averages: mortgages from Curinos via Experian (Sep 2026), car loans from Experian (Q2 2026). Lenders use their own models, often FICO&apos;s
        mortgage or auto versions.{" "}
        <Link href="/plans" className="text-primary hover:underline">Your plans price future loans from your score →</Link>
      </p>
    </section>
  )
}

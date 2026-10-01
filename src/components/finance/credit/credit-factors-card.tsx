"use client"

import type { CreditScoresResponse } from "@/hooks/finance/use-credit-scores"
import { UTILIZATION_BEST, UTILIZATION_OK } from "@/lib/finance/credit-scores"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"

const pct = (v: number) => `${Math.round(v * 100)}%`

/** FICO's published weights (myFICO). */
const FACTORS = [
  { weight: 35, label: "Payment history", text: "Paying every bill on time. One payment 30+ days late can cost dozens of points and stays for 7 years." },
  { weight: 30, label: "Amounts owed", text: "Mostly how much of your card limits you use. Lower is better; paying before the statement closes lowers it." },
  { weight: 15, label: "Length of history", text: "How old your accounts are on average. Keeping old cards open helps." },
  { weight: 10, label: "New credit", text: "Recent applications. Each hard inquiry costs a few points for about a year." },
  { weight: 10, label: "Credit mix", text: "Having both cards and installment loans (mortgage, car, student)." },
]

function status(share: number): { label: string; tone: string; icon: string } {
  if (share <= UTILIZATION_BEST) return { label: "Excellent", tone: "text-success", icon: "check_circle" }
  if (share <= UTILIZATION_OK) return { label: "Fine", tone: "text-foreground", icon: "check" }
  return { label: "High", tone: "text-warning", icon: "warning" }
}

function Utilization({ utilization }: { utilization: CreditScoresResponse["utilization"] }) {
  if (utilization.overall === null) {
    return <p className="text-xs text-foreground-muted">Connect a credit card with a known limit to see how much of your limits you&apos;re using.</p>
  }
  const s = status(utilization.overall)
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-foreground">Card utilization today</span>
        <span className={cn("inline-flex items-center gap-1 text-sm font-semibold tabular-nums", s.tone)}>
          <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">{s.icon}</span>
          {pct(utilization.overall)} · {s.label}
        </span>
      </div>
      <ul className="space-y-1">
        {utilization.cards.map((c) => (
          <li key={c.name} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-foreground-muted">{c.name}</span>
            <span className="tabular-nums text-foreground-muted">{fmtMoney(c.balance)} of {fmtMoney(c.limit)}</span>
            <span className={cn("w-10 text-right tabular-nums font-medium", status(c.share).tone)}>{pct(c.share)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-foreground-muted">
        Under {pct(UTILIZATION_OK)} helps; people with top scores tend to stay under {pct(UTILIZATION_BEST)}. Scores read the balance on your statement, so it changes month to month.
      </p>
    </div>
  )
}

/** What moves a score: the one factor the app can measure (card utilization), and FICO's weights. */
export function CreditFactorsCard({ utilization }: { utilization: CreditScoresResponse["utilization"] }) {
  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">What moves it</p>
        <p className="text-sm font-semibold text-foreground mt-1">The factors behind a FICO score</p>
      </div>
      <Utilization utilization={utilization} />
      <ul className="space-y-2 border-t border-card-border pt-3">
        {FACTORS.map((f) => (
          <li key={f.label} className="flex gap-3 text-xs">
            <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-foreground">{f.weight}%</span>
            <span className="text-foreground-muted">
              <span className="font-medium text-foreground">{f.label}.</span> {f.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

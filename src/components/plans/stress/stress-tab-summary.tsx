"use client"

import { StressDiagnosisCard } from "./stress-diagnosis-card"
import { StressEarlySales } from "./stress-early-sales"
import { StressKeyYearsCard } from "./stress-key-years-card"
import { StressStats } from "./stress-summary"
import type { StressViewModel } from "./stress-view-model"

/** Summary: the endings at a glance, why the plan fails (when it misses the target), and its key years. */
export function StressTabSummary({ v }: { v: StressViewModel }) {
  const rate = v.goal === "cash" ? v.all.successRate : v.all.netWorthRate
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <StressStats summary={v.summary} simulated={v.simulated} isHidden={v.isHidden} />
        <StressEarlySales cohorts={v.summary.cohorts} unit={v.unit} />
      </section>
      {rate < v.target && <StressDiagnosisCard insights={v.insights} onFix={v.onFix} />}
      <StressKeyYearsCard doc={v.doc} projection={v.projection} runOutAge={v.runOutAge} isHidden={v.isHidden} />
    </div>
  )
}

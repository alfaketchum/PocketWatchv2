"use client"

import { useState } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { useCreditScores, type CreditScoreItem } from "@/hooks/finance/use-credit-scores"
import { CreditScoreDialog } from "./add-credit-score-dialog"
import { CreditFactorsCard } from "./credit-factors-card"
import { CreditRatesCard } from "./credit-rates-card"
import { CreditScoreChart } from "./credit-score-chart"
import { CreditScoreHero } from "./credit-score-hero"
import { CreditScoreList } from "./credit-score-list"

type Editing = { score: CreditScoreItem | null } | null

/** Logged scores and how they've moved, card utilization, and what the score means for loan rates. */
export function CreditView() {
  const { data, isLoading, isError } = useCreditScores()
  const [editing, setEditing] = useState<Editing>(null)
  const scores = data?.scores ?? []
  const addButton = (
    <button type="button" onClick={() => setEditing({ score: null })} className="btn-primary text-sm inline-flex items-center gap-1.5">
      <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">add</span>
      Log a score
    </button>
  )
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Credit</h1>
          <p className="text-sm text-foreground-muted mt-0.5">Your credit score over time, what moves it, and what it means for the rates you&apos;d pay.</p>
        </div>
        {scores.length > 0 && addButton}
      </div>
      {isLoading ? (
        <div className="h-[420px] animate-shimmer rounded-2xl" />
      ) : isError ? (
        <EmptyState icon="error" variant="error" title="Couldn't load your credit scores" description="Try again in a moment." />
      ) : scores.length === 0 ? (
        <EmptyState
          icon="credit_score"
          title="Log your first credit score"
          description="Scores aren't pulled automatically. Look yours up for free in your bank or card issuer's app (many show a FICO or VantageScore), then log it here each time you check. Your full credit reports are free at annualcreditreport.com."
          action={{ label: "Log a score", onClick: () => setEditing({ score: null }) }}
        />
      ) : (
        <>
          <CreditScoreHero scores={scores} />
          {scores.length > 1 && (
            <section className="card p-5 sm:p-6 space-y-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Over time</p>
              <CreditScoreChart scores={scores} />
            </section>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <CreditFactorsCard utilization={data!.utilization} />
            <CreditRatesCard score={scores[0].score} />
          </div>
          <CreditScoreList scores={scores} onEdit={(score) => setEditing({ score })} />
        </>
      )}
      {editing && <CreditScoreDialog score={editing.score} defaultModel={scores[0]?.model ?? "fico8"} onClose={() => setEditing(null)} />}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useDeleteCreditScore, type CreditScoreItem } from "@/hooks/finance/use-credit-scores"
import { BUREAUS, modelLabel, scoreTier } from "@/lib/finance/credit-scores"
import { fmtScoreDate } from "./credit-helpers"

/** Every logged score, newest first, to correct or remove. */
export function CreditScoreList({ scores, onEdit }: { scores: CreditScoreItem[]; onEdit: (score: CreditScoreItem) => void }) {
  const remove = useDeleteCreditScore()
  const [confirming, setConfirming] = useState<string | null>(null)
  return (
    <section className="card p-5 sm:p-6 space-y-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">History</p>
      <ul className="divide-y divide-card-border">
        {scores.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-12 font-semibold tabular-nums text-foreground">{s.score}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-foreground">
                {modelLabel(s.model)}
                {s.bureau && <span className="text-foreground-muted"> · {BUREAUS.find((b) => b.value === s.bureau)?.label}</span>}
              </span>
              <span className="block truncate text-[11px] text-foreground-muted">
                {fmtScoreDate(s.date)} · {scoreTier(s.score).label}
                {s.note && ` · ${s.note}`}
              </span>
            </span>
            {confirming === s.id ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => setConfirming(null)} className="btn-ghost h-8 px-2 text-xs">
                  Keep
                </button>
                <button type="button" onClick={() => remove.mutate(s.id, { onSettled: () => setConfirming(null) })} className="btn-secondary h-8 px-2 text-xs text-error">
                  Delete
                </button>
              </span>
            ) : (
              <>
                <button type="button" onClick={() => onEdit(s)} aria-label={`Edit score from ${fmtScoreDate(s.date)}`} className="btn-ghost h-8 px-2 text-foreground-muted hover:text-foreground">
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">edit</span>
                </button>
                <button type="button" onClick={() => setConfirming(s.id)} aria-label={`Delete score from ${fmtScoreDate(s.date)}`} className="btn-ghost h-8 px-2 text-foreground-muted hover:text-error">
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">delete</span>
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

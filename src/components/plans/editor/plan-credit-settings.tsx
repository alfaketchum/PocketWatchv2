"use client"

import { useMemo } from "react"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { useCreditScores } from "@/hooks/finance/use-credit-scores"
import { scoreTier } from "@/lib/finance/credit-scores"
import { planCreditPath } from "@/lib/plans/credit-projection"
import { MORTGAGE_MIN_SCORE } from "@/lib/plans/credit-rates"
import { expandPlan, generatedDebts } from "@/lib/plans/plan-expand"
import type { PlanCredit, PlanDocument, PlanSettings } from "@/lib/plans/plan-types"
import { CreditPathChart } from "./credit-path-chart"

const DEFAULT_SCORE = 740
const today = () => new Date().toISOString().slice(0, 10)
const monthYear = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })

/** The latest logged score, with the card limits known today. */
function useLatestCredit(): PlanCredit | null {
  const { data } = useCreditScores()
  const latest = data?.scores[0]
  if (!latest) return null
  const limits = data.utilization.cards.reduce((s, c) => s + c.limit, 0)
  return { score: latest.score, asOf: latest.date.slice(0, 10), ...(limits > 0 ? { cardLimit: limits } : {}) }
}

/** Loans from planned purchases whose terms aren't decided: the score sets their rate. */
function PricedLoans({ doc }: { doc: PlanDocument }) {
  const priced = useMemo(() => {
    const undecided = new Set(doc.assets.filter((a) => a.financing?.mode === "undecided").map((a) => a.id))
    const path = planCreditPath(doc)
    const rates = new Map(expandPlan(doc).debts.map((d) => [d.id, d.rate]))
    return generatedDebts(doc)
      .filter((g) => g.assetId && undecided.has(g.assetId) && !g.debt.id.includes("~"))
      .map((g) => ({ name: g.debt.name, year: g.year, score: g.year !== null ? path?.[g.year - doc.settings.startYear]?.pricing ?? null : null, rate: rates.get(g.debt.id) ?? g.debt.rate }))
  }, [doc])
  if (priced.length === 0) {
    return <p className="text-[11px] text-foreground-muted">It prices purchases whose loan is &ldquo;Not decided yet&rdquo;. Loans you set terms for keep your rate.</p>
  }
  return (
    <ul className="space-y-0.5 text-[11px] text-foreground-muted">
      {priced.map((p) => (
        <li key={p.name}>
          <span className="text-foreground">{p.name}</span>
          {p.year !== null && `, ${p.year}`}: projected {p.score ?? "—"} → {(p.rate * 100).toFixed(2)}%
          {p.score !== null && p.score < MORTGAGE_MIN_SCORE && " (below most lenders' minimum)"}
        </li>
      ))}
    </ul>
  )
}

/** Assumptions › Credit score: today's score, how it's projected, and the loans it prices. */
export function PlanCreditSettings({ doc, set }: { doc: PlanDocument; set: (change: Partial<PlanSettings>) => void }) {
  const credit = doc.settings.credit
  const latest = useLatestCredit()
  const path = useMemo(() => planCreditPath(doc), [doc])
  const setCredit = (change: Partial<PlanCredit>) => credit && set({ credit: { ...credit, ...change } })
  const latestButton = latest && (!credit || latest.score !== credit.score || latest.asOf !== credit.asOf) && (
    <button type="button" onClick={() => set({ credit: latest })} className="text-[11px] text-primary hover:underline">
      Use my latest ({latest.score}, {monthYear(latest.asOf)})
    </button>
  )
  return (
    <InputBlock title="Credit score" description="Sets typical rates on loans you haven't fixed yet, and is projected over the plan (a rough estimate).">
      {!credit ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" onClick={() => set({ credit: { score: DEFAULT_SCORE, asOf: today() } })} className="text-[11px] text-primary hover:underline">
            + Add a credit score
          </button>
          {latestButton}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <FireNumberField
              label={`Score (${scoreTier(credit.score).label})`}
              min={300}
              max={850}
              value={credit.score}
              onChange={(v) => setCredit({ score: Math.min(850, Math.max(300, Math.round(v))), asOf: today() })}
            />
            <FireNumberField
              label="Card limits (total)"
              prefix="$"
              min={0}
              value={credit.cardLimit ?? 0}
              onChange={(v) => setCredit({ cardLimit: v > 0 ? v : undefined })}
            />
            <button
              type="button"
              onClick={() => set({ credit: undefined })}
              aria-label="Remove credit score"
              className="btn-ghost h-[34px] px-2 text-foreground-muted hover:text-error"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                delete
              </span>
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
            <span>As of {monthYear(credit.asOf)}</span>
            {credit.cardLimit ? <span>Card debt is measured against {fmtMoney(credit.cardLimit)} of limits</span> : <span>Add card limits to count card balances</span>}
            {latestButton}
          </div>
          {path && <CreditPathChart path={path} />}
          <PricedLoans doc={doc} />
        </div>
      )}
    </InputBlock>
  )
}

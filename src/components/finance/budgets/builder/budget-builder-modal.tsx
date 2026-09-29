"use client"

import { useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  useFinanceBudgets, useFinanceTrends, useFinanceIncome, useBudgetAI,
  useGenerateBudgetPlan, useSaveBudgetPlan,
} from "@/hooks/use-finance"
import { BudgetBuilderMethodPicker } from "./budget-builder-method-picker"
import { BudgetBuilderSimpleEditor } from "./budget-builder-simple-editor"
import { BudgetBuilderManualEditor } from "./budget-builder-manual-editor"
import { BudgetBuilderReview } from "./budget-builder-review"
import { BudgetBuilderAILoading } from "./budget-builder-ai-loading"
import { BudgetBuilderAIProposal } from "./budget-builder-ai-proposal"
import {
  avgMonthlyIncome, typicalMonthlySpend, buildCategoryStats, buildInitialDraft, completeTrendMonths,
  diffDraft, draftFromProposal, draftTotal, saveAmount,
} from "./budget-builder-helpers"
import { DEFAULT_BUDGET_LOOKBACK, type BudgetLookback } from "@/lib/finance/budget-lookback"
import type { BuilderMethod, BuilderStep, DraftLine, ExistingBudget } from "./budget-builder-types"

interface BudgetBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const TITLES: Record<BuilderStep, string> = {
  choose: "Create budget",
  "ai-loading": "Building your AI budget",
  "ai-proposal": "AI budget proposal",
  edit: "Adjust your budget",
  review: "Review changes",
}

/** Large popup offering AI / set-a-total / manual budget creation, ending in a single bulk save. */
export function BudgetBuilderModal({ isOpen, onClose, onSaved }: BudgetBuilderModalProps) {
  const [lookback, setLookback] = useState<BudgetLookback>(DEFAULT_BUDGET_LOOKBACK)
  const { data: budgets } = useFinanceBudgets()
  // One extra month so dropping the in-progress month still leaves `lookback` complete months.
  const { data: trends, isFetching: trendsLoading } = useFinanceTrends(lookback + 1)
  const { data: incomeData } = useFinanceIncome()
  const { data: aiInfo } = useBudgetAI()
  const generate = useGenerateBudgetPlan()
  const save = useSaveBudgetPlan()

  const [step, setStep] = useState<BuilderStep>("choose")
  const [method, setMethod] = useState<BuilderMethod>("simple")
  const [lines, setLines] = useState<DraftLine[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const aiRequest = useRef(0)

  const existing: ExistingBudget[] = useMemo(
    () => (budgets ?? []).map((b) => ({ category: b.category, monthlyLimit: b.baseMonthlyLimit ?? b.monthlyLimit })),
    [budgets],
  )
  const months = useMemo(() => completeTrendMonths(trends?.months, lookback), [trends, lookback])
  const stats = useMemo(() => buildCategoryStats(months), [months])
  const income = incomeData?.override ?? avgMonthlyIncome(months)
  const typicalSpend = typicalMonthlySpend(stats)

  const diff = useMemo(() => diffDraft(existing, lines), [existing, lines])
  const hasChanges = diff.added.length + diff.changed.length + diff.removed.length > 0

  const openEditor = (m: BuilderMethod, next: DraftLine[], summary: string | null = null) => {
    setMethod(m)
    setLines(next)
    setAiSummary(summary)
    setEditorKey((k) => k + 1)
    setStep("edit")
  }

  const runAI = (force = false) => {
    const id = ++aiRequest.current
    setAiError(null)
    setStep("ai-loading")
    generate.mutate({ months: lookback, force }, {
      onSuccess: (res) => {
        if (id !== aiRequest.current) return
        setMethod("ai")
        setLines(draftFromProposal(res.proposal.categories, existing, stats))
        setAiSummary(res.proposal.summary)
        setStep("ai-proposal")
      },
      onError: (e) => { if (id === aiRequest.current) setAiError(e.message) },
    })
  }

  const pick = (m: BuilderMethod) => {
    if (m === "ai") return runAI()
    openEditor(m, buildInitialDraft(existing, stats, m === "simple"))
  }

  const fillSuggestions = () => {
    const have = new Set(lines.map((l) => l.category))
    const extra = buildInitialDraft([], stats, true).filter((l) => !have.has(l.category))
    setLines([...lines, ...extra])
  }

  const handleSave = () => {
    save.mutate({
      upsert: [...diff.added.map((a) => ({ category: a.category, monthlyLimit: a.amount })), ...diff.changed.map((c) => ({ category: c.category, monthlyLimit: c.to }))],
      remove: diff.removed.map((r) => r.category),
    }, {
      onSuccess: () => {
        toast.success("Budget saved")
        handleClose()
        onSaved()
      },
      onError: (e) => toast.error(e.message),
    })
  }

  const handleClose = () => {
    aiRequest.current++
    setStep("choose")
    setLines([])
    setAiSummary(null)
    setAiError(null)
    onClose()
  }

  if (!isOpen || typeof document === "undefined") return null

  const cancelAI = () => { aiRequest.current++; setAiError(null); setStep("choose") }
  const backTarget: BuilderStep | null = step === "edit" || step === "ai-proposal" ? "choose" : step === "review" ? "edit" : null
  const rejectAI = () => { setLines([]); setAiSummary(null); setStep("choose") }
  const editAI = (m: "simple" | "manual") => { setMethod(m); setEditorKey((k) => k + 1); setStep("edit") }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="budget-builder-title" className="bg-card border border-card-border w-full max-w-4xl rounded-2xl overflow-hidden max-h-[90dvh] flex flex-col" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {backTarget && (
              <button onClick={() => setStep(backTarget)} className="touch-target rounded-md hover:bg-foreground/5 transition-colors" aria-label="Back">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>arrow_back</span>
              </button>
            )}
            <h2 id="budget-builder-title" className="text-base font-semibold text-foreground">{TITLES[step]}</h2>
          </div>
          <button onClick={handleClose} className="touch-target rounded-md hover:bg-foreground/5 transition-colors" aria-label="Close">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 scroll-touch">
          {step === "choose" && (
            <BudgetBuilderMethodPicker
              hasBudgets={existing.length > 0}
              providerLabel={aiInfo?.providerLabel ?? null}
              lookback={lookback}
              onLookbackChange={setLookback}
              monthsAvailable={trendsLoading ? null : months.length}
              onPick={pick}
            />
          )}
          {step === "ai-loading" && (
            <BudgetBuilderAILoading months={months.length || lookback} providerLabel={aiInfo?.providerLabel ?? null} error={aiError} onRetry={() => runAI(true)} onCancel={cancelAI} />
          )}
          {step === "ai-proposal" && (
            <BudgetBuilderAIProposal summary={aiSummary} lines={lines} existing={existing} diff={diff} income={income} typicalSpend={typicalSpend} />
          )}
          {step === "edit" && method !== "manual" && (
            <BudgetBuilderSimpleEditor key={editorKey} lines={lines} onChange={setLines} stats={stats} income={income} typicalSpend={typicalSpend} aiSummary={aiSummary} onSwitchToManual={() => setMethod("manual")} />
          )}
          {step === "edit" && method === "manual" && (
            <BudgetBuilderManualEditor months={months.length} lines={lines} onChange={setLines} stats={stats} income={income} typicalSpend={typicalSpend} onFillSuggestions={fillSuggestions} />
          )}
          {step === "review" && <BudgetBuilderReview diff={diff} total={draftTotal(lines.map((l) => ({ ...l, amount: saveAmount(l.amount) })))} income={income} typicalSpend={typicalSpend} />}
        </div>

        {step === "ai-proposal" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-card-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={rejectAI} className="px-4 py-2 text-sm font-semibold text-error hover:bg-error/10 rounded-xl transition-colors">Reject</button>
              <button onClick={() => runAI(true)} className="text-xs font-medium text-foreground-muted hover:text-foreground">Regenerate</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => editAI("manual")} className="px-4 py-2 text-sm font-semibold text-foreground bg-background-secondary border border-card-border rounded-xl hover:border-card-border-hover transition-colors">Edit amounts</button>
              <button onClick={() => editAI("simple")} className="px-4 py-2 text-sm font-semibold text-foreground bg-background-secondary border border-card-border rounded-xl hover:border-card-border-hover transition-colors">Adjust with sliders</button>
              <button onClick={handleSave} disabled={!hasChanges || save.isPending} className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {save.isPending ? "Saving…" : hasChanges ? "Accept & save" : "Matches your budgets"}
              </button>
            </div>
          </div>
        )}
        {(step === "edit" || step === "review") && (
          <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-card-border flex-shrink-0">
            {step === "edit" && aiSummary ? (
              <button onClick={() => runAI(true)} className="text-xs font-medium text-foreground-muted hover:text-foreground">Regenerate with AI</button>
            ) : <span />}
            {step === "edit" ? (
              <button onClick={() => setStep("review")} disabled={!hasChanges} className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {hasChanges ? "Review changes" : "No changes yet"}
              </button>
            ) : (
              <button onClick={handleSave} disabled={!hasChanges || save.isPending} className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {save.isPending ? "Saving…" : "Save budget"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

"use client"

import { useEffect, useState } from "react"

const stages = (months: number) => [
  `Reading ${months} months of transactions…`,
  "Breaking categories down by subcategory…",
  "Checking subscriptions and fixed costs…",
  "Drafting category amounts…",
]
const STAGE_MS = 8_000

interface BudgetBuilderAILoadingProps {
  months: number
  providerLabel: string | null
  error: string | null
  onRetry: () => void
  onCancel: () => void
}

export function BudgetBuilderAILoading({ months, providerLabel, error, onRetry, onCancel }: BudgetBuilderAILoadingProps) {
  const STAGES = stages(months)
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (error) return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)
    return () => clearInterval(t)
  }, [error])

  if (error) {
    return (
      <div className="py-12 text-center space-y-3">
        <span className="material-symbols-rounded text-error block" style={{ fontSize: 32 }} aria-hidden="true">error</span>
        <p className="text-sm text-foreground">{error}</p>
        <div className="flex justify-center gap-2">
          <button onClick={onRetry} className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Try again</button>
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-foreground-muted hover:text-foreground">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-12 text-center space-y-4" aria-live="polite">
      <span className="material-symbols-rounded text-primary block animate-pulse" style={{ fontSize: 36 }} aria-hidden="true">auto_awesome</span>
      <div>
        <p className="text-sm font-medium text-foreground">{STAGES[stage]}</p>
        <p className="text-xs text-foreground-muted mt-1">
          {providerLabel ? `${providerLabel} can take up to a minute or two.` : "This can take up to a minute or two."}
        </p>
      </div>
      <button onClick={onCancel} className="text-xs font-medium text-foreground-muted hover:text-foreground">Cancel</button>
    </div>
  )
}

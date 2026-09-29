"use client"

import { useState } from "react"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { formatCurrency } from "@/lib/utils"
import { WorkshopCategoryPicker } from "@/components/finance/budget-workshop/workshop-category-picker"
import { BudgetBuilderSliderRow } from "./budget-builder-slider-row"
import { BudgetBuilderSummaryBar } from "./budget-builder-summary-bar"
import { addLine, draftTotal, rebalance, removeLine, scaleToTotal, updateLine } from "./budget-builder-helpers"
import type { CategoryStats, DraftLine } from "./budget-builder-types"

interface BudgetBuilderSimpleEditorProps {
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
  stats: Map<string, CategoryStats>
  income: number
  avgSpend: number
  /** AI summary shown above the sliders when the draft came from an AI proposal. */
  aiSummary?: string | null
  onSwitchToManual: () => void
}

/** One monthly total, split across categories with percentage sliders. */
export function BudgetBuilderSimpleEditor({ lines, onChange, stats, income, avgSpend, aiSummary, onSwitchToManual }: BudgetBuilderSimpleEditorProps) {
  const total = draftTotal(lines)
  const [totalInput, setTotalInput] = useState(String(Math.round(total)))
  const [picking, setPicking] = useState(false)
  const lockedSum = lines.filter((l) => l.locked).reduce((s, l) => s + l.amount, 0)

  const commitTotal = (raw: string) => {
    const next = Math.max(Math.round(lockedSum), Number(raw) || 0)
    setTotalInput(String(next))
    if (next !== Math.round(total)) onChange(scaleToTotal(lines, next))
  }

  // Adding/removing a line changes the total; keep the input in sync.
  const replace = (next: DraftLine[]) => {
    setTotalInput(String(Math.round(draftTotal(next))))
    onChange(next)
  }

  const available = getBudgetableCategories().filter((c) => !lines.some((l) => l.category === c))

  return (
    <div className="space-y-4">
      {aiSummary && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-foreground leading-relaxed flex gap-2">
          <span className="material-symbols-rounded text-primary flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true">auto_awesome</span>
          <p>{aiSummary}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Monthly total</span>
          <span className="relative flex items-center mt-1">
            <span className="absolute left-3 text-lg text-foreground-muted">$</span>
            <input
              type="number"
              min={0}
              step={50}
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              onBlur={(e) => commitTotal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitTotal((e.target as HTMLInputElement).value) }}
              className="w-44 pl-7 pr-3 py-2 text-2xl font-bold tabular-nums bg-background-secondary border border-card-border rounded-xl text-foreground outline-none focus:border-primary"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-2 pb-1">
          {avgSpend > 0 && <Chip label={`Avg spend ${formatCurrency(avgSpend, "USD", 0)}`} onClick={() => commitTotal(String(Math.round(avgSpend)))} />}
          {income > 0 && <Chip label={`80% of income ${formatCurrency(income * 0.8, "USD", 0)}`} onClick={() => commitTotal(String(Math.round(income * 0.8)))} />}
        </div>
      </div>

      <BudgetBuilderSummaryBar total={total} income={income} avgSpend={avgSpend} />

      <div className="rounded-2xl border border-card-border bg-card">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
            Split · {lines.length} categories
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => setPicking((p) => !p)} className="text-xs font-medium text-primary hover:underline">
              {picking ? "Done adding" : "Add category"}
            </button>
            <button onClick={onSwitchToManual} className="text-xs font-medium text-foreground-muted hover:text-foreground">
              Edit amounts manually
            </button>
          </div>
        </div>
        {picking && available.length > 0 && (
          <WorkshopCategoryPicker categories={available} onAdd={(c) => replace(addLine(lines, c, stats))} />
        )}
        <div className="px-4">
          {lines.length === 0 ? (
            <p className="text-sm text-foreground-muted py-8 text-center">No categories yet. Add one to start splitting your total.</p>
          ) : lines.map((l) => (
            <BudgetBuilderSliderRow
              key={l.category}
              line={l}
              total={total}
              onPctChange={(pct) => onChange(rebalance(lines, l.category, pct, total))}
              onToggleLock={() => onChange(updateLine(lines, l.category, { locked: !l.locked }))}
              onRemove={() => replace(removeLine(lines, l.category))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-foreground/5 text-foreground-muted hover:text-foreground transition-colors">
      {label}
    </button>
  )
}
